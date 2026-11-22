/**
 * integration.test.js — end-to-end flows spanning multiple subsystems.
 * All tests are in a single describe block to guarantee sequential execution
 * and shared state (applicationId, accountId, transactionIds).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';

const PASS = 'IntTest1!@';
const ts = Date.now();

const EMAILS = {
  customer:  `int-customer-${ts}@test.local`,
  employee:  `int-employee-${ts}@test.local`,
  managerR:  `int-mgr-r-${ts}@test.local`,
  managerA:  `int-mgr-a-${ts}@test.local`,
  cashier:   `int-cashier-${ts}@test.local`,
  ops:       `int-ops-${ts}@test.local`,
  sysadmin:  `int-sysadmin-${ts}@test.local`,
};

const userIds = {};
const agents = {};
// Shared mutable state — flows build on each other sequentially within the describe block
let applicationId = null;
let accountId     = null;
let depositTxnId  = null;

before(async () => {
  const hash = await bcrypt.hash(PASS, 10);
  const roleMap = {
    customer:  'Customer',
    employee:  'Account Opening Employee',
    managerR:  'Manager/Authorized Approver',
    managerA:  'Manager/Authorized Approver',
    cashier:   'Cashier/Teller',
    ops:       'Operations/Finance',
    sysadmin:  'System Administrator',
  };
  for (const [key, roleName] of Object.entries(roleMap)) {
    const [[role]] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);
    assert.ok(role, `Role ${roleName} must exist`);
    const [r] = await pool.query(
      'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
      [EMAILS[key], hash, role.id, 'active'],
    );
    userIds[key] = r.insertId;
    agents[key] = supertest.agent(app);
    const loginRes = await agents[key].post('/api/auth/login').send({ email: EMAILS[key], password: PASS });
    assert.equal(loginRes.status, 200, `Login failed for ${key}: ${JSON.stringify(loginRes.body)}`);
  }
});

after(async () => {
  const ids = Object.values(userIds).filter(Boolean);
  if (ids.length === 0) return;
  if (accountId) {
    await pool.query('DELETE FROM ledger_entries WHERE account_id = ?', [accountId]);
    const [txns] = await pool.query('SELECT id FROM transactions WHERE initiated_by IN (?)', [ids]);
    const txnIds = txns.map(r => r.id);
    if (txnIds.length > 0) {
      await pool.query('DELETE FROM audit_log WHERE entity_type = ? AND entity_id IN (?)', ['transaction', txnIds]);
      // Clear FK references before deleting
      await pool.query('UPDATE transactions SET related_transaction_id = NULL WHERE id IN (?)', [txnIds]);
      await pool.query('DELETE FROM transactions WHERE id IN (?)', [txnIds]);
    }
    await pool.query('DELETE FROM audit_log WHERE entity_type = ? AND entity_id = ?', ['bank_account', accountId]);
    await pool.query('DELETE FROM bank_accounts WHERE id = ?', [accountId]);
  }
  await pool.query('DELETE FROM account_applications WHERE customer_user_id IN (?)', [ids]);
  await pool.query('DELETE FROM users WHERE id IN (?)', [ids]);
});

// ── All integration tests in ONE describe so they run sequentially ───────────
describe('Integration: Full end-to-end banking flows', () => {

  // ── Flow 1: Customer Onboarding ──────────────────────────────────────────

  it('1a. Customer creates draft application', async () => {
    const res = await agents.customer.post('/api/applications').send({
      first_name: 'Abebe', last_name: 'Kebede',
      date_of_birth: '1990-05-15',
      national_id: `ET-INT-${ts}`,
      nationality: 'Ethiopian',
      phone: '+251911000001',
      email: EMAILS.customer,
      address_line1: 'Bole Road, Addis Ababa',
      city: 'Addis Ababa',
      account_type: 'SAVINGS',
      initial_deposit_amount: 500.00,
      currency: 'ETB',
      terms_accepted: 1,
      privacy_accepted: 1,
    });
    assert.equal(res.status, 201, `Create draft failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.application.status, 'DRAFT');
    assert.ok(res.body.application.reference_number.startsWith('APP-'));
    applicationId = res.body.application.id;
    assert.ok(applicationId, 'applicationId must be set');
  });

  it('1b. Customer submits application → SUBMITTED', async () => {
    assert.ok(applicationId, 'applicationId must be set from 1a');
    const res = await agents.customer.post(`/api/applications/${applicationId}/submit`);
    assert.equal(res.status, 200, `Submit failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.application.status, 'SUBMITTED');
  });

  it('1c. Employee starts review → UNDER_REVIEW', async () => {
    const res = await agents.employee
      .post(`/api/applications/${applicationId}/review`)
      .send({ notes: 'Documents look good.' });
    assert.equal(res.status, 200, `Review failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.application.status, 'UNDER_REVIEW');
    // Set reviewed_by to managerR for self-approval test
    await pool.query('UPDATE account_applications SET reviewed_by = ? WHERE id = ?',
      [userIds.managerR, applicationId]);
  });

  it('1d. Self-approval is blocked (reviewer tries to approve)', async () => {
    const res = await agents.managerR
      .post(`/api/applications/${applicationId}/approve`)
      .send({ notes: 'Self-approving — must fail' });
    assert.equal(res.status, 409, `Self-approval must be 409: ${JSON.stringify(res.body)}`);
  });

  it('1e. Different manager approves → APPROVED', async () => {
    const res = await agents.managerA
      .post(`/api/applications/${applicationId}/approve`)
      .send({ notes: 'Approved after compliance review.' });
    assert.equal(res.status, 200, `Approve failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.application.status, 'APPROVED');
  });

  it('1f. Manager creates bank account from approved application', async () => {
    const res = await agents.managerA
      .post(`/api/applications/${applicationId}/create-account`);
    assert.equal(res.status, 201, `Create account failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.application.status, 'ACCOUNT_CREATED');
    assert.ok(res.body.account.account_number.startsWith('ETB-'));
    accountId = res.body.account.id;
    assert.ok(accountId, 'accountId must be set');
    // Activate the account so it accepts transactions
    await pool.query(
      "UPDATE bank_accounts SET status = 'ACTIVE', opened_at = NOW() WHERE id = ?",
      [accountId],
    );
  });

  it('1g. Customer sees their ACTIVE account', async () => {
    const res = await agents.customer.get('/api/accounts/my');
    assert.equal(res.status, 200, `Get accounts failed: ${JSON.stringify(res.body)}`);
    const accts = res.body.data;
    assert.ok(Array.isArray(accts), 'Should return array');
    const found = accts.find(a => a.id === accountId);
    assert.ok(found, 'Customer must see their account');
    assert.equal(found.status, 'ACTIVE');
  });

  // ── Flow 2: Teller Transactions ─────────────────────────────────────────

  it('2a. Teller deposits into customer account', async () => {
    const res = await agents.cashier.post('/api/transactions/deposit').send({
      accountId, amount: 5000, description: 'Initial deposit',
    });
    assert.equal(res.status, 201, `Deposit failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.data.transaction.status, 'POSTED');
    assert.equal(res.body.data.transaction.transaction_type, 'DEPOSIT');
    depositTxnId = res.body.data.transaction.id;
    const [[acct]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountId]);
    assert.equal(Number(acct.balance), 5000);
  });

  it('2b. Teller withdraws from customer account', async () => {
    const res = await agents.cashier.post('/api/transactions/withdrawal').send({
      accountId, amount: 1000, description: 'Cash withdrawal',
    });
    assert.equal(res.status, 201, `Withdrawal failed: ${JSON.stringify(res.body)}`);
    const [[acct]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountId]);
    assert.equal(Number(acct.balance), 4000);
  });

  it('2c. Ops/Finance reverses the deposit', async () => {
    const res = await agents.ops.post('/api/transactions/reverse').send({
      transactionId: depositTxnId, reason: 'Test reversal',
    });
    assert.equal(res.status, 201, `Reversal failed: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.data.transaction.transaction_type, 'REVERSAL');
    assert.equal(res.body.data.originalTransaction.status, 'REVERSED');
  });

  it('2d. Ledger is balanced after all operations', async () => {
    const { verifyLedgerBalance } = await import('../src/services/ledgerService.js');
    const result = await verifyLedgerBalance(accountId);
    assert.equal(result.balanced, true,
      `Ledger imbalanced: diff=${result.diff}, stored=${result.storedBalance}, ledger=${result.ledgerBalance}`);
  });

  // ── Flow 3: Cross-role authorization ────────────────────────────────────

  it('3a. Customer cannot make a teller deposit (403)', async () => {
    const res = await agents.customer.post('/api/transactions/deposit').send({
      accountId, amount: 100,
    });
    assert.equal(res.status, 403, `Customer must not deposit: ${JSON.stringify(res.body)}`);
  });

  it('3b. Cashier cannot approve an application (403)', async () => {
    // Create a dummy UNDER_REVIEW application for this assertion
    const [r] = await pool.query(
      `INSERT INTO account_applications
       (reference_number, customer_user_id, status, first_name, last_name,
        date_of_birth, national_id, phone, email, address_line1, city)
       VALUES (?, ?, 'UNDER_REVIEW', 'Test', 'User', '1990-01-01', ?, ?, ?, 'Test St', 'Addis')`,
      [`APP-RBAC-${ts}`, userIds.customer, `RBAC-${ts}`, `+251922${ts % 100000}`, `rbac-${ts}@test.local`],
    );
    const dummyId = r.insertId;
    const res = await agents.cashier.post(`/api/applications/${dummyId}/approve`).send({ notes: 'test' });
    assert.equal(res.status, 403, `Cashier must not approve: ${JSON.stringify(res.body)}`);
    await pool.query('DELETE FROM account_applications WHERE id = ?', [dummyId]);
  });

  it('3c. System Administrator cannot reverse transactions (403 — no ledger.post)', async () => {
    // Make a fresh deposit to have a reversible transaction
    await pool.query('UPDATE bank_accounts SET balance = 1000, available_balance = 1000 WHERE id = ?', [accountId]);
    const depRes = await agents.cashier.post('/api/transactions/deposit').send({
      accountId, amount: 100,
    });
    assert.equal(depRes.status, 201, `Setup deposit failed: ${JSON.stringify(depRes.body)}`);
    const txnId = depRes.body.data.transaction.id;
    const res = await agents.sysadmin.post('/api/transactions/reverse').send({
      transactionId: txnId, reason: 'Sysadmin should not reverse',
    });
    assert.equal(res.status, 403, `SysAdmin must not reverse: ${JSON.stringify(res.body)}`);
  });

  it('3d. Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await supertest(app).get('/api/accounts/my');
    assert.equal(res.status, 401, 'Unauthenticated must get 401');
  });
});
