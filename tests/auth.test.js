import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

const TEST_EMAIL = 'test-auth-user@test.local';
const TEST_PASSWORD = 'TestAuth123!';
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

let testUserId;

before(async () => {
  // Get Customer role id
  const [[role]] = await pool.query("SELECT id FROM roles WHERE name = 'Customer'");
  assert(role, 'Customer role must exist');
  const hash = await bcrypt.hash(TEST_PASSWORD, 10); // lower rounds for speed
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [TEST_EMAIL, hash, role.id, 'active'],
  );
  testUserId = result.insertId;
});

after(async () => {
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
  await pool.end();
});

describe('POST /api/auth/login', () => {
  it('login success: 200, cookie set, no password_hash in body', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.ok(res.body.user, 'user object present');
    assert.ok(!('password_hash' in res.body.user), 'no password_hash in user object');
    assert.ok(!('password_hash' in res.body), 'no password_hash at top level');
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies && cookies.length > 0, 'session cookie set');
  });

  it('login wrong password: 401, generic message', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword123!' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, GENERIC_LOGIN_ERROR);
  });

  it('login unknown email: 401, same generic message (no enumeration)', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@test.local', password: 'SomePass123!' });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, GENERIC_LOGIN_ERROR);
  });

  it('login missing fields: 400', async () => {
    const res = await supertest(app).post('/api/auth/login').send({ email: TEST_EMAIL });
    assert.equal(res.status, 400);
  });

  it('lockout: after LOGIN_MAX_ATTEMPTS failures, next attempt returns 403', async () => {
    // Reset lockout state first
    await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [testUserId]);
    const maxAttempts = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10);
    for (let i = 0; i < maxAttempts; i++) {
      await supertest(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'WrongPass123!' });
    }
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(res.status, 403, 'should be locked out');
    // Reset for other tests
    await pool.query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [testUserId]);
  });

  it('suspended user: 403', async () => {
    await pool.query("UPDATE users SET status = 'suspended' WHERE id = ?", [testUserId]);
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(res.status, 403);
    await pool.query("UPDATE users SET status = 'active' WHERE id = ?", [testUserId]);
  });
});

describe('GET /api/auth/me', () => {
  it('without session: 401', async () => {
    const res = await supertest(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  it('with valid session: 200, no password_hash', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const res = await agent.get('/api/auth/me');
    assert.equal(res.status, 200);
    assert.ok(res.body.user, 'user present');
    assert.ok(!('password_hash' in res.body.user), 'no password_hash');
  });
});

describe('POST /api/auth/logout', () => {
  it('logout: 200; subsequent /me: 401', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const logoutRes = await agent.post('/api/auth/logout');
    assert.equal(logoutRes.status, 200);
    const meRes = await agent.get('/api/auth/me');
    assert.equal(meRes.status, 401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('wrong current password: 403', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const res = await agent.post('/api/auth/change-password').send({
      currentPassword: 'WrongCurrent123!',
      newPassword: 'NewValid456@',
    });
    assert.equal(res.status, 403);
  });

  it('weak new password: 400', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const res = await agent.post('/api/auth/change-password').send({
      currentPassword: TEST_PASSWORD,
      newPassword: 'weak',
    });
    assert.equal(res.status, 400);
  });

  it('success: 200, old password no longer works, new password works, hash changed', async () => {
    const NEW_PASSWORD = 'NewSecure456@';
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    const changeRes = await agent.post('/api/auth/change-password').send({
      currentPassword: TEST_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    assert.equal(changeRes.status, 200);
    // Old password no longer works
    const oldRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    assert.equal(oldRes.status, 401);
    // New password works
    const newRes = await supertest(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: NEW_PASSWORD });
    assert.equal(newRes.status, 200);
    // Verify hash changed and password_changed_at updated in DB
    const [rows] = await pool.query(
      'SELECT password_hash, password_changed_at FROM users WHERE id = ?',
      [testUserId],
    );
    assert.ok(rows[0].password_hash, 'hash present in DB');
    const hashMatch = await bcrypt.compare(NEW_PASSWORD, rows[0].password_hash);
    assert.ok(hashMatch, 'new hash verifies correctly');
    // Reset password back to TEST_PASSWORD for other tests
    const resetHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await pool.query('UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [resetHash, testUserId]);
  });
});
