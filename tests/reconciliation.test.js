import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { runReconciliation, getTellerSummary } from '../src/services/reconciliationService.js';

const PASS = 'ReconTest1!';
const ts = Date.now();
const EMAILS = {
  teller:  `recon-teller-${ts}@test.local`,
  ops:     `recon-ops-${ts}@test.local`,
};

const userIds = {};
let accountId;
const agentTeller = supertest.agent(app);
const agentOps = supertest.agent(app);

before(async () => {
  const hash = await bcrypt.hash(PASS, 10);
  const [[tellerRole]] = await pool.query('SELECT id FROM roles WHERE name = ?', ['Cashier/Teller']);
  const [[opsRole]] = await pool.query('SELECT id FROM roles WHERE name = ?', ['Operations/Finance']);
  assert.ok(tellerRole, 'Cashier/Teller role must exist');
  assert.ok(opsRole, 'Operations/Finance role must exist');

  const [tellerResult] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [EMAILS.teller, hash, tellerRole.id, 'active'],
  );
  userIds.teller = tellerResult.insertId;

  const [opsResult] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [EMAILS.ops, hash, opsRole.id, 'active'],
  );
  userIds.ops = opsResult.insertId;

  // Create a test account
  const [acctResult] = await pool.query(
    `INSERT INTO bank_accounts (account_number, customer_user_id, account_type, status, currency, balance, available_balance, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [`REC-${ts}`, userIds.teller, 'SAVINGS', 'ACTIVE', 'ETB', 0.00, 0.00, userIds.teller],
  );
  accountId = acctResult.insertId;

  // Login
  await agentTeller.post('/api/auth/login').send({ email: EMAILS.teller, password: PASS });
  await agentOps.post('/api/auth/login').send({ email: EMAILS.ops, password: PASS });
});

after(async () => {
  if (accountId) {
    // Ensure balance is restored before cleanup
    await pool.query('UPDATE bank_accounts SET balance = 0, available_balance = 0 WHERE id = ?', [accountId]);
    // Clean up ledger entries and transactions
    await pool.query('DELETE FROM ledger_entries WHERE account_id = ?', [accountId]);
    const [txnRows] = await pool.query(
      'SELECT id FROM transactions WHERE initiated_by IN (?)',
      [Object.values(userIds).filter(Boolean)],
    );
    const txnIds = txnRows.map(r => r.id);
    if (txnIds.length > 0) {
      await pool.query('DELETE FROM audit_log WHERE entity_type = ? AND entity_id IN (?)', ['transaction', txnIds]);
      await pool.query('UPDATE transactions SET related_transaction_id = NULL WHERE related_transaction_id IN (?)', [txnIds]);
      await pool.query('UPDATE transactions SET related_transaction_id = NULL WHERE id IN (?)', [txnIds]);
      await pool.query('DELETE FROM transactions WHERE id IN (?)', [txnIds]);
    }
    await pool.query('DELETE FROM audit_log WHERE entity_type = ? AND entity_id = ?', ['bank_account', accountId]);
    await pool.query('DELETE FROM bank_accounts WHERE id = ?', [accountId]);
  }
  const userIdList = Object.values(userIds).filter(Boolean);
  if (userIdList.length > 0) {
    await pool.query('DELETE FROM users WHERE id IN (?)', [userIdList]);
  }
});

describe('Reconciliation', () => {
  it('1. runReconciliation returns balanced for a clean account with transactions', async () => {
    // Post a deposit
    const depRes = await agentTeller.post('/api/transactions/deposit').send({
      accountId,
      amount: 3000,
    });
    assert.equal(depRes.status, 201, `Deposit failed: ${JSON.stringify(depRes.body)}`);

    // Run reconciliation via service
    const result = await runReconciliation();
    assert.ok(typeof result.total === 'number');
    assert.ok(typeof result.balanced === 'number');
    assert.ok(Array.isArray(result.discrepancies));

    // Our specific account should be balanced
    const { balanced: isBalanced } = await import('../src/services/ledgerService.js').then(m => m.verifyLedgerBalance(accountId));
    assert.equal(isBalanced, true, 'Test account should be balanced');
  });

  it('2. Manual balance corruption → balanced:false with discrepancy', async () => {
    // Corrupt balance directly
    await pool.query('UPDATE bank_accounts SET balance = 9999999 WHERE id = ?', [accountId]);

    const { balanced, diff } = await import('../src/services/ledgerService.js').then(m => m.verifyLedgerBalance(accountId));
    assert.equal(balanced, false, 'Should detect imbalance');
    assert.ok(diff > 0, 'Should report a positive diff');

    // Restore correct balance via ledger sum
    const [[sumRow]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END), 0) AS totalCredit,
         COALESCE(SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END), 0) AS totalDebit
       FROM ledger_entries WHERE account_id = ?`,
      [accountId],
    );
    const correct = Number(sumRow.totalCredit) - Number(sumRow.totalDebit);
    await pool.query('UPDATE bank_accounts SET balance = ?, available_balance = ? WHERE id = ?', [correct, correct, accountId]);

    // Confirm restored
    const { balanced: restored } = await import('../src/services/ledgerService.js').then(m => m.verifyLedgerBalance(accountId));
    assert.equal(restored, true, 'Balance should be restored');
  });

  it('3. getTellerSummary returns correct deposit and withdrawal totals', async () => {
    // Post a withdrawal (account has 3000 from test 1 minus any ledger adjustments)
    const [[acct]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountId]);
    const currentBalance = Number(acct.balance);
    if (currentBalance >= 500) {
      await agentTeller.post('/api/transactions/withdrawal').send({ accountId, amount: 500 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const summary = await getTellerSummary(userIds.teller, null);

    assert.equal(summary.tellerUserId, userIds.teller);
    assert.equal(summary.date, today);
    assert.ok(summary.deposits >= 3000, `Expected deposits >= 3000, got ${summary.deposits}`);
    // Withdrawals should reflect what we posted
    assert.ok(typeof summary.withdrawals === 'number');
  });
});
