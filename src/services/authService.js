import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { config } from '../config/env.js';

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.role_id, r.name AS role_name,
            u.status, u.failed_login_attempts, u.locked_until, u.last_login_at,
            u.password_changed_at, u.must_change_password, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE LOWER(u.email) = LOWER(?)`,
    [email],
  );
  return rows[0] || null;
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export async function recordFailedLogin(userId) {
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
           ELSE locked_until
         END
     WHERE id = ?`,
    [config.loginMaxAttempts, config.loginLockMinutes, userId],
  );
}

export async function recordSuccessfulLogin(userId) {
  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?`,
    [userId],
  );
}

export function isLockedOut(user) {
  if (!user.locked_until) return false;
  return new Date(user.locked_until) > new Date();
}

export function validatePasswordPolicy(plain) {
  const errors = [];
  if (!plain || plain.length < 12) errors.push('Password must be at least 12 characters long.');
  if (!/[A-Z]/.test(plain)) errors.push('Password must contain at least one uppercase letter.');
  if (!/[a-z]/.test(plain)) errors.push('Password must contain at least one lowercase letter.');
  if (!/[0-9]/.test(plain)) errors.push('Password must contain at least one digit.');
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`'"]/.test(plain)) errors.push('Password must contain at least one special character.');
  return { valid: errors.length === 0, errors };
}

export async function changePassword(userId, currentPlain, newPlain) {
  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!rows[0]) throw Object.assign(new Error('User not found'), { status: 404 });
  const match = await bcrypt.compare(currentPlain, rows[0].password_hash);
  if (!match) throw Object.assign(new Error('Current password is incorrect'), { status: 403 });
  const policy = validatePasswordPolicy(newPlain);
  if (!policy.valid) {
    const err = Object.assign(new Error('Password does not meet policy requirements'), { status: 400 });
    err.errors = policy.errors;
    throw err;
  }
  const sameAsCurrent = await bcrypt.compare(newPlain, rows[0].password_hash);
  if (sameAsCurrent) throw Object.assign(new Error('New password must differ from current password'), { status: 400 });
  const newHash = await hashPassword(newPlain);
  await pool.query(
    `UPDATE users SET password_hash = ?, password_changed_at = NOW(), must_change_password = 0 WHERE id = ?`,
    [newHash, userId],
  );
}
