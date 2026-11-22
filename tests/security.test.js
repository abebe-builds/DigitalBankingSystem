import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

const SEC_EMAIL = 'sec-test@test.local';
const SEC_PASSWORD = 'SecTest123!';
let secUserId;

before(async () => {
  const [[role]] = await pool.query("SELECT id FROM roles WHERE name = 'Customer'");
  const hash = await bcrypt.hash(SEC_PASSWORD, 10);
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [SEC_EMAIL, hash, role.id, 'active'],
  );
  secUserId = result.insertId;
});

after(async () => {
  if (secUserId) {
    await pool.query('DELETE FROM users WHERE id = ?', [secUserId]);
  }
  // Do NOT call pool.end() here — pool is shared. See tests/teardown.test.js.
});

describe('Password storage security', () => {
  it('password_hash in DB is a valid bcrypt hash, not plaintext', async () => {
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [secUserId]);
    const { password_hash } = rows[0];
    assert.ok(password_hash.startsWith('$2'), 'hash must start with bcrypt prefix $2');
    assert.notEqual(password_hash, SEC_PASSWORD, 'hash must not be plaintext');
    const matches = await bcrypt.compare(SEC_PASSWORD, password_hash);
    assert.ok(matches, 'bcrypt.compare must return true for correct password');
  });
});

describe('API response does not leak password_hash', () => {
  it('GET /api/auth/me response does not contain password_hash or password', async () => {
    const agent = supertest.agent(app);
    await agent.post('/api/auth/login').send({ email: SEC_EMAIL, password: SEC_PASSWORD });
    const res = await agent.get('/api/auth/me');
    assert.equal(res.status, 200);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('password_hash'), 'no password_hash in /me response');
    assert.ok(!bodyStr.includes('"password"'), 'no password field in /me response');
  });

  it('POST /api/auth/login response does not contain password_hash', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: SEC_EMAIL, password: SEC_PASSWORD });
    assert.equal(res.status, 200);
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('password_hash'), 'no password_hash in login response');
  });

  it('session cookie is HttpOnly', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: SEC_EMAIL, password: SEC_PASSWORD });
    assert.equal(res.status, 200);
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies && cookies.length > 0, 'cookie must be set on login');
    const sessionCookie = cookies.find((c) => c.toLowerCase().includes('httponly'));
    assert.ok(sessionCookie, 'session cookie must have HttpOnly flag');
  });
});
