import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

const TEST_PASS = 'RbacTest123!';
const ROLE_EMAILS = {
  'System Administrator': 'rbac-sysadmin@test.local',
  'Customer': 'rbac-customer@test.local',
  'Cashier/Teller': 'rbac-cashier@test.local',
  'Manager/Authorized Approver': 'rbac-manager@test.local',
  'Auditor': 'rbac-auditor@test.local',
};
const testUserIds = {};

before(async () => {
  const hash = await bcrypt.hash(TEST_PASS, 10);
  for (const [roleName, email] of Object.entries(ROLE_EMAILS)) {
    const [[role]] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    assert(role, `Role ${roleName} must exist`);
    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
      [email, hash, role.id, 'active'],
    );
    testUserIds[roleName] = result.insertId;
  }
});

after(async () => {
  const ids = Object.values(testUserIds).filter(Boolean);
  if (ids.length > 0) {
    await pool.query('DELETE FROM users WHERE id IN (?)', [ids]);
  }
  await pool.end();
});

async function loginAs(roleName) {
  const agent = supertest.agent(app);
  await agent.post('/api/auth/login').send({ email: ROLE_EMAILS[roleName], password: TEST_PASS });
  return agent;
}

describe('GET /api/users', () => {
  it('sysadmin has users.view: 200', async () => {
    const agent = await loginAs('System Administrator');
    const res = await agent.get('/api/users');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
  });

  it('customer lacks users.view: 403', async () => {
    const agent = await loginAs('Customer');
    const res = await agent.get('/api/users');
    assert.equal(res.status, 403);
  });
});

describe('sysadmin permission exclusions', () => {
  it('sysadmin does NOT have ledger.post (data-level enforcement)', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'System Administrator' AND p.code = 'ledger.post'`,
    );
    assert.equal(rows.length, 0, 'sysadmin must NOT have ledger.post');
  });

  it('sysadmin does NOT have teller.deposit', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'System Administrator' AND p.code = 'teller.deposit'`,
    );
    assert.equal(rows.length, 0, 'sysadmin must NOT have teller.deposit');
  });

  it('sysadmin does NOT have applications.approve', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'System Administrator' AND p.code = 'applications.approve'`,
    );
    assert.equal(rows.length, 0, 'sysadmin must NOT have applications.approve');
  });
});

describe('requirePermission checks', () => {
  it('cashier has teller.deposit', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Cashier/Teller' AND p.code = 'teller.deposit'`,
    );
    assert.equal(rows.length, 1, 'cashier must have teller.deposit');
  });

  it('customer does NOT have teller.deposit', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Customer' AND p.code = 'teller.deposit'`,
    );
    assert.equal(rows.length, 0, 'customer must NOT have teller.deposit');
  });

  it('manager has applications.approve', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Manager/Authorized Approver' AND p.code = 'applications.approve'`,
    );
    assert.equal(rows.length, 1, 'manager must have applications.approve');
  });

  it('cashier does NOT have applications.approve', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Cashier/Teller' AND p.code = 'applications.approve'`,
    );
    assert.equal(rows.length, 0, 'cashier must NOT have applications.approve');
  });

  it('auditor has audit.read', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Auditor' AND p.code = 'audit.read'`,
    );
    assert.equal(rows.length, 1, 'auditor must have audit.read');
  });

  it('customer does NOT have audit.read', async () => {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN roles r ON r.id = rp.role_id
       WHERE r.name = 'Customer' AND p.code = 'audit.read'`,
    );
    assert.equal(rows.length, 0, 'customer must NOT have audit.read');
  });
});

describe('no self-role-escalation endpoint', () => {
  it('PATCH /api/users/:id/role does not exist (404)', async () => {
    const agent = await loginAs('System Administrator');
    const res = await agent.patch('/api/users/1/role').send({ role: 'System Administrator' });
    assert.equal(res.status, 404);
  });
});
