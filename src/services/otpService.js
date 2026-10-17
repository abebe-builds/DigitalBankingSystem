import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { config } from '../config/env.js';

/**
 * Generate a cryptographically random 6-digit string, zero-padded.
 * randomInt(0, 1000000) gives [0, 999999] inclusive.
 */
export function generateOTP() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Create an OTP record for a user+purpose. Invalidates any existing unused OTPs
 * for the same user+purpose. Returns the plaintext OTP (only available here —
 * never stored or returned to the client after this call).
 *
 * @param {number} userId
 * @param {'PHONE_VERIFICATION'|'EMAIL_VERIFICATION'|'APPLICATION_APPROVAL'} purpose
 * @param {number|null} applicationId
 * @returns {Promise<string>} plaintext OTP (6 digits)
 */
export async function createOTP(userId, purpose, applicationId = null) {
  const plaintext = generateOTP();
  const hash = await bcrypt.hash(plaintext, config.bcryptRounds);
  const expiresAt = new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);

  // Invalidate previous unused OTPs for same user + purpose
  await pool.query(
    `UPDATE otp_tokens SET is_used = 1, used_at = NOW()
     WHERE user_id = ? AND purpose = ? AND is_used = 0`,
    [userId, purpose],
  );

  await pool.query(
    `INSERT INTO otp_tokens (user_id, application_id, purpose, token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, applicationId, purpose, hash, expiresAt],
  );

  // In development, log plaintext for testing. Never log in production.
  if (config.isDevelopment) {
    console.log(`[DEV ONLY] OTP for user ${userId} (${purpose}): ${plaintext}`);
  }

  return plaintext;
}

/**
 * Verify a submitted OTP token.
 * Returns { valid: true } on success (marks used).
 * Returns { valid: false, reason: '...' } on failure.
 *
 * @param {number} userId
 * @param {'PHONE_VERIFICATION'|'EMAIL_VERIFICATION'|'APPLICATION_APPROVAL'} purpose
 * @param {string} submittedToken  plaintext OTP to check
 * @param {number|null} applicationId
 */
export async function verifyOTP(userId, purpose, submittedToken, applicationId = null) {
  // Find the most recent unused, non-expired OTP for this user+purpose
  let query = `SELECT * FROM otp_tokens
               WHERE user_id = ? AND purpose = ? AND is_used = 0 AND expires_at > NOW()`;
  const params = [userId, purpose];
  if (applicationId !== null) {
    query += ` AND application_id = ?`;
    params.push(applicationId);
  }
  query += ` ORDER BY created_at DESC LIMIT 1`;

  const [rows] = await pool.query(query, params);
  const record = rows[0];

  if (!record) {
    return { valid: false, reason: 'No valid OTP found or OTP has expired' };
  }

  // Check max attempts before trying (prevents timing attacks after lockout)
  if (parseInt(record.attempts, 10) >= config.otp.maxAttempts) {
    return { valid: false, reason: 'Maximum OTP attempts exceeded' };
  }

  // Increment attempts before comparing (prevents race conditions)
  await pool.query(`UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = ?`, [record.id]);

  const match = await bcrypt.compare(submittedToken, record.token_hash);

  if (!match) {
    const newAttempts = parseInt(record.attempts, 10) + 1;
    if (newAttempts >= config.otp.maxAttempts) {
      // Lock OTP after final failed attempt
      await pool.query(`UPDATE otp_tokens SET is_used = 1, used_at = NOW() WHERE id = ?`, [record.id]);
      return { valid: false, reason: 'Maximum OTP attempts exceeded — OTP locked' };
    }
    return { valid: false, reason: 'Invalid OTP' };
  }

  // Mark as used on success
  await pool.query(`UPDATE otp_tokens SET is_used = 1, used_at = NOW() WHERE id = ?`, [record.id]);
  return { valid: true };
}

/**
 * Delete expired OTP tokens. Safe to call frequently (e.g. from cleanup jobs or tests).
 * @returns {Promise<number>} number of rows deleted
 */
export async function cleanupExpiredOTPs() {
  const [result] = await pool.query(
    `DELETE FROM otp_tokens WHERE expires_at < NOW() AND is_used = 0`,
  );
  return result.affectedRows;
}
