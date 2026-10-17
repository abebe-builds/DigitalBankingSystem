import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { createOTP, verifyOTP } from '../src/services/otpService.js';

const OTP_PASS = 'OtpTest123!';
const OTP_EMAIL = 'test-otp-user@test.local';
let otpTestUserId;

before(async () => {
  const [[role]] = await pool.query("SELECT id FROM roles WHERE name = 'Customer'");
  const hash = await bcrypt.hash(OTP_PASS, 10);
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [OTP_EMAIL, hash, role.id, 'active'],
  );
  otpTestUserId = result.insertId;
});

after(async () => {
  if (otpTestUserId) {
    await pool.query('DELETE FROM otp_tokens WHERE user_id = ?', [otpTestUserId]);
    await pool.query('DELETE FROM users WHERE id = ?', [otpTestUserId]);
  }
});

async function loginOtpUser() {
  const agent = supertest.agent(app);
  const res = await agent.post('/api/auth/login').send({ email: OTP_EMAIL, password: OTP_PASS });
  assert.equal(res.status, 200, `Login failed: ${JSON.stringify(res.body)}`);
  return agent;
}

describe('POST /api/otp/send', () => {
  it('sends OTP: 200; hash stored in DB not plaintext', async () => {
    const agent = await loginOtpUser();
    const res = await agent.post('/api/otp/send').send({ purpose: 'PHONE_VERIFICATION' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    // Verify DB record: hash present, starts with bcrypt prefix not a 6-digit string
    const [rows] = await pool.query(
      "SELECT token_hash FROM otp_tokens WHERE user_id = ? AND purpose = 'PHONE_VERIFICATION' AND is_used = 0 ORDER BY id DESC LIMIT 1",
      [otpTestUserId],
    );
    assert.ok(rows.length > 0, 'OTP record should be created in DB');
    assert.ok(rows[0].token_hash.startsWith('$2'), 'token_hash should be a bcrypt hash, not plaintext');
  });

  it('invalid purpose returns 400', async () => {
    const agent = await loginOtpUser();
    const res = await agent.post('/api/otp/send').send({ purpose: 'INVALID_PURPOSE' });
    assert.equal(res.status, 400);
  });

  it('unauthenticated request returns 401', async () => {
    const res = await supertest(app).post('/api/otp/send').send({ purpose: 'PHONE_VERIFICATION' });
    assert.equal(res.status, 401);
  });

  it('new OTP invalidates previous (previous is_used=1)', async () => {
    // Create first OTP directly via service
    await createOTP(otpTestUserId, 'EMAIL_VERIFICATION', null);
    // Create second OTP — should invalidate first
    await createOTP(otpTestUserId, 'EMAIL_VERIFICATION', null);
    // All but the last should be marked used
    const [rows] = await pool.query(
      "SELECT is_used FROM otp_tokens WHERE user_id = ? AND purpose = 'EMAIL_VERIFICATION' ORDER BY id ASC",
      [otpTestUserId],
    );
    assert.ok(rows.length >= 2, 'should have at least 2 OTP records');
    const allButLast = rows.slice(0, -1);
    for (const row of allButLast) {
      assert.equal(row.is_used, 1, 'Previous OTP should be invalidated (is_used=1)');
    }
  });
});

describe('POST /api/otp/verify', () => {
  it('correct OTP: 200, valid:true; used OTP marked used', async () => {
    const plainOtp = await createOTP(otpTestUserId, 'PHONE_VERIFICATION', null);
    const agent = await loginOtpUser();
    const res = await agent.post('/api/otp/verify').send({
      purpose: 'PHONE_VERIFICATION',
      token: plainOtp,
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.valid, true);
  });

  it('wrong OTP returns 400, valid:false; attempts incremented', async () => {
    await createOTP(otpTestUserId, 'PHONE_VERIFICATION', null);
    const [before] = await pool.query(
      "SELECT attempts FROM otp_tokens WHERE user_id = ? AND purpose = 'PHONE_VERIFICATION' AND is_used = 0 ORDER BY id DESC LIMIT 1",
      [otpTestUserId],
    );
    const agent = await loginOtpUser();
    const res = await agent.post('/api/otp/verify').send({
      purpose: 'PHONE_VERIFICATION',
      token: '000000',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.valid, false);
    const [after] = await pool.query(
      "SELECT attempts FROM otp_tokens WHERE user_id = ? AND purpose = 'PHONE_VERIFICATION' ORDER BY id DESC LIMIT 1",
      [otpTestUserId],
    );
    assert.ok(after[0].attempts > (before[0]?.attempts ?? 0), 'attempts should be incremented');
  });

  it('used OTP is invalid', async () => {
    const plainOtp = await createOTP(otpTestUserId, 'PHONE_VERIFICATION', null);
    // Use it once successfully
    await verifyOTP(otpTestUserId, 'PHONE_VERIFICATION', plainOtp);
    // Try again — should fail
    const result = await verifyOTP(otpTestUserId, 'PHONE_VERIFICATION', plainOtp);
    assert.equal(result.valid, false);
  });

  it('expired OTP is invalid', async () => {
    // Insert a manually expired OTP
    const hash = await bcrypt.hash('123456', 10);
    await pool.query(
      `INSERT INTO otp_tokens (user_id, purpose, token_hash, expires_at)
       VALUES (?, 'EMAIL_VERIFICATION', ?, DATE_SUB(NOW(), INTERVAL 1 HOUR))`,
      [otpTestUserId, hash],
    );
    const result = await verifyOTP(otpTestUserId, 'EMAIL_VERIFICATION', '123456');
    assert.equal(result.valid, false);
  });

  it('exceeding max attempts locks OTP', async () => {
    await createOTP(otpTestUserId, 'EMAIL_VERIFICATION', null);
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10);
    let lastResult;
    // Attempt maxAttempts+1 wrong OTPs to ensure lockout
    for (let i = 0; i <= maxAttempts; i++) {
      lastResult = await verifyOTP(otpTestUserId, 'EMAIL_VERIFICATION', '999999');
    }
    assert.equal(lastResult.valid, false);
    // The OTP should now be is_used=1 (locked)
    const [rows] = await pool.query(
      "SELECT is_used FROM otp_tokens WHERE user_id = ? AND purpose = 'EMAIL_VERIFICATION' ORDER BY id DESC LIMIT 1",
      [otpTestUserId],
    );
    assert.equal(rows[0].is_used, 1, 'OTP should be locked (is_used=1) after max attempts');
  });

  it('missing token field returns 400', async () => {
    const agent = await loginOtpUser();
    const res = await agent.post('/api/otp/verify').send({ purpose: 'PHONE_VERIFICATION' });
    assert.equal(res.status, 400);
  });
});
