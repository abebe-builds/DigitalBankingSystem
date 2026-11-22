import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { verifyLedgerBalance } from '../src/services/ledgerService.js';

const PASS = 'LedgerTest1!';
const ts = Date.now();
const EMAILS = {
  teller:      `ledger-teller-${ts}@test.local`,
  customer:    `ledger-cust-${ts}@test.local`,
  opsFinance:  `ledger-ops-${ts}@test.local`,
};

const userIds = {};
const accountIds = {};
const agentTeller = supertest.agent(app);
const agentOps = supertest.agent(app);

before(async () => {
  const hash = await bcrypt.hash(PASS, 10);
  const roleRows = await Promise.all([
    pool.query('SELECT id FROM roles WHERE name = ?', ['Cashier/Teller']),
    pool.query('SELECT id FROM roles WHERE name = ?', ['Customer']),
    pool.query('SELECT id FROM roles WHERE name = ?', ['Operations/Finance']),
  ]);
  const [tellerRole, customerRole, opsRole] = roleRows.map(([[rows]]) => rows);
  assert.ok(tellerRole, 'Cashier/Teller role must exist');
  assert.ok(customerRole, 'Customer role must exist');
  assert.ok(opsRole, 'Operations/Finance role must exist');

  // Create users
  const [tellerResult] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [EMAILS.teller, hash, tellerRole.id, 'active'],
  );
  userIds.teller = tellerResult.insertId;

  const [custResult] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [EMAILS.customer, hash, customerRole.id, 'active'],
  );
  userIds.customer = custResult.insertId;

  const [opsResult] = await pool.query(
    'INSERT INTO users (email, password_hash, role_id, status) VALUES (?, ?, ?, ?)',
    [EMAILS.opsFinance, hash, opsRole.id, 'active'],
  );
  userIds.opsFinance = opsResult.insertId;

  // Create test bank accounts directly with ACTIVE status
  const acctNum1 = `TST-${ts}-S`;
  const acctNum2 = `TST-${ts}-C`;
  const acctNum3 = `TST-${ts}-F`;

  const [acct1] = await pool.query(
    `INSERT INTO bank_accounts (account_number, customer_user_id, account_type, status, currency, balance, available_balance, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [acctNum1, userIds.customer, 'SAVINGS', 'ACTIVE', 'ETB', 0.00, 0.00, userIds.teller],
  );
  accountIds.savings = acct1.insertId;

  const [acct2] = await pool.query(
    `INSERT INTO bank_accounts (account_number, customer_user_id, account_type, status, currency, balance, available_balance, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [acctNum2, userIds.customer, 'CHECKING', 'ACTIVE', 'ETB', 0.00, 0.00, userIds.teller],
  );
  accountIds.checking = acct2.insertId;

  const [acct3] = await pool.query(
    `INSERT INTO bank_accounts (account_number, customer_user_id, account_type, status, currency, balance, available_balance, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [acctNum3, userIds.customer, 'FIXED_DEPOSIT', 'ACTIVE', 'ETB', 0.00, 0.00, userIds.teller],
  );
  accountIds.fixedDeposit = acct3.insertId;

  // Create a second savings account for transfer tests
  const acctNum4 = `TST-${ts}-S2`;
  const [acct4] = await pool.query(
    `INSERT INTO bank_accounts (account_number, customer_user_id, account_type, status, currency, balance, available_balance, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [acctNum4, userIds.customer, 'SAVINGS', 'ACTIVE', 'ETB', 0.00, 0.00, userIds.teller],
  );
  accountIds.savings2 = acct4.insertId;

  // Create a checking account for daily limit tests (higher limits)
  const acctNum5 = `TST-${ts}-C2`;
  const [acct5] = await pool.query(
    `INSERT INTO bank_accounts (account_number, customer_user_id, account_type, status, currency, balance, available_balance, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [acctNum5, userIds.customer, 'CHECKING', 'ACTIVE', 'ETB', 0.00, 0.00, userIds.teller],
  );
  accountIds.checkingLimit = acct5.insertId;

  // Login teller
  await agentTeller.post('/api/auth/login').send({ email: EMAILS.teller, password: PASS });
  // Login ops/finance
  await agentOps.post('/api/auth/login').send({ email: EMAILS.opsFinance, password: PASS });
});

after(async () => {
  const acctIdList = Object.values(accountIds).filter(Boolean);
  const userIdList = Object.values(userIds).filter(Boolean);

  if (acctIdList.length > 0) {
    // Delete audit log entries for these accounts
    await pool.query(
      'DELETE FROM audit_log WHERE entity_type = ? AND entity_id IN (?)',
      ['bank_account', acctIdList],
    );
    // Delete ledger entries for transactions involving test accounts
    await pool.query(
      'DELETE le FROM ledger_entries le WHERE le.account_id IN (?)',
      [acctIdList],
    );
    // Delete audit log entries for transactions
    const [txnRows] = await pool.query(
      'SELECT DISTINCT t.id FROM transactions t WHERE t.initiated_by IN (?)',
      [userIdList],
    );
    const txnIds = txnRows.map(r => r.id);
    if (txnIds.length > 0) {
      await pool.query('DELETE FROM audit_log WHERE entity_type = ? AND entity_id IN (?)', ['transaction', txnIds]);
      // Reset related_transaction_id before deleting to avoid FK issues
      await pool.query('UPDATE transactions SET related_transaction_id = NULL WHERE related_transaction_id IN (?)', [txnIds]);
      await pool.query('UPDATE transactions SET related_transaction_id = NULL WHERE id IN (?)', [txnIds]);
      await pool.query('DELETE FROM transactions WHERE id IN (?)', [txnIds]);
    }
    await pool.query('DELETE FROM bank_accounts WHERE id IN (?)', [acctIdList]);
  }
  if (userIdList.length > 0) {
    await pool.query('DELETE FROM users WHERE id IN (?)', [userIdList]);
  }
});

describe('Ledger — deposits', () => {
  it('1. Deposit: creates CREDIT ledger entry, balance updated, transaction POSTED', async () => {
    const res = await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.savings,
      amount: 5000,
      description: 'Test deposit',
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.status, 'ok');
    const { transaction, ledgerEntries } = res.body.data;
    assert.equal(transaction.status, 'POSTED');
    assert.equal(transaction.transaction_type, 'DEPOSIT');
    assert.equal(Number(transaction.amount), 5000);
    assert.ok(transaction.reference_number.startsWith('TXN-'), 'Reference should start with TXN-');
    assert.ok(Array.isArray(ledgerEntries) && ledgerEntries.length === 1, 'Should have one ledger entry');
    assert.equal(ledgerEntries[0].entry_type, 'CREDIT');
    assert.equal(Number(ledgerEntries[0].amount), 5000);
    assert.equal(Number(ledgerEntries[0].running_balance), 5000);

    // Verify actual DB balance
    const [[acct]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    assert.equal(Number(acct.balance), 5000);
  });
});

describe('Ledger — withdrawals', () => {
  it('2. Withdrawal: creates DEBIT entry, balance updated', async () => {
    // savings account has 5000 from test 1
    const res = await agentTeller.post('/api/transactions/withdrawal').send({
      accountId: accountIds.savings,
      amount: 1000,
      description: 'Test withdrawal',
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.equal(res.body.status, 'ok');
    const { transaction, ledgerEntries } = res.body.data;
    assert.equal(transaction.status, 'POSTED');
    assert.equal(transaction.transaction_type, 'WITHDRAWAL');
    assert.equal(Number(transaction.amount), 1000);
    assert.equal(ledgerEntries[0].entry_type, 'DEBIT');
    assert.equal(Number(ledgerEntries[0].running_balance), 4000);

    const [[acct]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    assert.equal(Number(acct.balance), 4000);
  });

  it('3. Insufficient funds withdrawal → 400', async () => {
    const res = await agentTeller.post('/api/transactions/withdrawal').send({
      accountId: accountIds.savings,
      amount: 999999,
      description: 'Should fail',
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /insufficient funds/i);
  });
});

describe('Ledger — transfers', () => {
  it('4. Transfer: both balances updated, two ledger entries', async () => {
    // First deposit into savings to fund it
    await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.savings,
      amount: 10000,
    });

    const [[fromBefore]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    const [[toBefore]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings2]);

    const res = await agentTeller.post('/api/transactions/transfer').send({
      fromAccountId: accountIds.savings,
      toAccountId: accountIds.savings2,
      amount: 2000,
      description: 'Test transfer',
    });
    assert.equal(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    const { transaction, ledgerEntries } = res.body.data;
    assert.equal(transaction.status, 'POSTED');
    assert.equal(transaction.transaction_type, 'TRANSFER_DEBIT');
    assert.equal(ledgerEntries.length, 2);

    const debitEntry = ledgerEntries.find(e => e.entry_type === 'DEBIT');
    const creditEntry = ledgerEntries.find(e => e.entry_type === 'CREDIT');
    assert.ok(debitEntry, 'Should have a DEBIT entry');
    assert.ok(creditEntry, 'Should have a CREDIT entry');
    assert.equal(Number(debitEntry.amount), 2000);
    assert.equal(Number(creditEntry.amount), 2000);

    const [[fromAfter]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    const [[toAfter]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings2]);
    assert.equal(Number(fromAfter.balance), Number(fromBefore.balance) - 2000);
    assert.equal(Number(toAfter.balance), Number(toBefore.balance) + 2000);
  });

  it('5. Transfer to non-existent account → 404', async () => {
    const res = await agentTeller.post('/api/transactions/transfer').send({
      fromAccountId: accountIds.savings,
      toAccountId: 999999,
      amount: 100,
    });
    assert.equal(res.status, 404, `Expected 404, got ${res.status}: ${JSON.stringify(res.body)}`);
  });

  it('6. Transfer insufficient funds → 400', async () => {
    const res = await agentTeller.post('/api/transactions/transfer').send({
      fromAccountId: accountIds.savings2,
      toAccountId: accountIds.savings,
      amount: 9999999,
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /insufficient funds/i);
  });
});

describe('Ledger — daily limits', () => {
  it('7. Daily withdrawal limit: third withdrawal exceeds CHECKING daily limit → 400', async () => {
    // CHECKING: daily_withdrawal=100000, single_transaction=50000
    // Deposit 200000 into checkingLimit account — use 4 deposits of 50000 each
    // to stay within the CHECKING single-transaction limit of 50000 ETB
    for (let i = 0; i < 4; i++) {
      await agentTeller.post('/api/transactions/deposit').send({
        accountId: accountIds.checkingLimit,
        amount: 50000,
      });
    }

    // First withdrawal: 40000 (total: 40000, OK)
    const w1 = await agentTeller.post('/api/transactions/withdrawal').send({
      accountId: accountIds.checkingLimit,
      amount: 40000,
    });
    assert.equal(w1.status, 201, `First withdrawal should succeed: ${JSON.stringify(w1.body)}`);

    // Second withdrawal: 40000 (total: 80000, OK)
    const w2 = await agentTeller.post('/api/transactions/withdrawal').send({
      accountId: accountIds.checkingLimit,
      amount: 40000,
    });
    assert.equal(w2.status, 201, `Second withdrawal should succeed: ${JSON.stringify(w2.body)}`);

    // Third withdrawal: 40000 (total would be 120000 > 100000, FAIL)
    const w3 = await agentTeller.post('/api/transactions/withdrawal').send({
      accountId: accountIds.checkingLimit,
      amount: 40000,
    });
    assert.equal(w3.status, 400, `Third withdrawal should fail: ${JSON.stringify(w3.body)}`);
    assert.match(w3.body.error, /daily withdrawal limit/i);
  });
});

describe('Ledger — idempotency', () => {
  it('8. Same idempotency key returns same transaction (200 on repeat)', async () => {
    const iKey = `idem-test-${ts}`;
    // First call
    const r1 = await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.savings,
      amount: 100,
      idempotencyKey: iKey,
    });
    assert.equal(r1.status, 201);
    const txnId1 = r1.body.data.transaction.id;

    // Second call with same key
    const r2 = await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.savings,
      amount: 100,
      idempotencyKey: iKey,
    });
    assert.equal(r2.status, 200, `Expected 200 for idempotent call: ${JSON.stringify(r2.body)}`);
    assert.equal(r2.body.data.transaction.id, txnId1, 'Should return same transaction ID');
  });
});

describe('Ledger — balance verification', () => {
  it('9. verifyLedgerBalance returns balanced=true after deposit+withdrawal', async () => {
    const result = await verifyLedgerBalance(accountIds.savings);
    assert.equal(result.balanced, true, `Expected balanced, got diff=${result.diff}, ledger=${result.ledgerBalance}, stored=${result.storedBalance}`);
  });
});

describe('Ledger — reversals', () => {
  it('10. Reversal of a deposit: original REVERSED, balance restored', async () => {
    // Get current savings balance before test deposit
    const [[before]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    const balanceBefore = Number(before.balance);

    // Make a deposit
    const depRes = await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.savings,
      amount: 500,
      description: 'To be reversed',
    });
    assert.equal(depRes.status, 201);
    const origTxnId = depRes.body.data.transaction.id;

    // Verify balance increased
    const [[afterDeposit]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    assert.equal(Number(afterDeposit.balance), balanceBefore + 500);

    // Reverse it using ops/finance user (has ledger.post)
    const revRes = await agentOps.post('/api/transactions/reverse').send({
      transactionId: origTxnId,
      reason: 'Test reversal',
    });
    assert.equal(revRes.status, 201, `Expected 201, got ${revRes.status}: ${JSON.stringify(revRes.body)}`);
    const { transaction, ledgerEntries, originalTransaction } = revRes.body.data;
    assert.equal(transaction.transaction_type, 'REVERSAL');
    assert.equal(transaction.status, 'POSTED');
    assert.equal(originalTransaction.status, 'REVERSED');

    // Verify reversal ledger entry is DEBIT (opposite of original CREDIT)
    const debitEntry = ledgerEntries.find(e => e.entry_type === 'DEBIT');
    assert.ok(debitEntry, 'Reversal should have a DEBIT entry');
    assert.equal(Number(debitEntry.amount), 500);

    // Verify balance restored
    const [[afterReversal]] = await pool.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountIds.savings]);
    assert.equal(Number(afterReversal.balance), balanceBefore, `Balance should be restored to ${balanceBefore}`);

    // Verify original transaction is REVERSED in DB
    const [[origTxn]] = await pool.query('SELECT status FROM transactions WHERE id = ?', [origTxnId]);
    assert.equal(origTxn.status, 'REVERSED');
  });

  it('11. Cannot reverse a reversal → 400', async () => {
    // Make a deposit then reverse it
    const depRes = await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.savings2,
      amount: 200,
    });
    assert.equal(depRes.status, 201);
    const origTxnId = depRes.body.data.transaction.id;

    const revRes = await agentOps.post('/api/transactions/reverse').send({
      transactionId: origTxnId,
      reason: 'First reversal',
    });
    assert.equal(revRes.status, 201);
    const reversalTxnId = revRes.body.data.transaction.id;

    // Try to reverse the reversal
    const rev2Res = await agentOps.post('/api/transactions/reverse').send({
      transactionId: reversalTxnId,
      reason: 'Reversal of reversal',
    });
    assert.equal(rev2Res.status, 400, `Expected 400, got ${rev2Res.status}: ${JSON.stringify(rev2Res.body)}`);
    assert.match(rev2Res.body.error, /cannot reverse a reversal/i);
  });
});

describe('Ledger — fixed deposit', () => {
  it('12. Fixed deposit account rejects withdrawal → 400', async () => {
    // First deposit into fixed deposit account
    await agentTeller.post('/api/transactions/deposit').send({
      accountId: accountIds.fixedDeposit,
      amount: 10000,
    });

    const res = await agentTeller.post('/api/transactions/withdrawal').send({
      accountId: accountIds.fixedDeposit,
      amount: 1000,
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.match(res.body.error, /fixed deposit/i);
  });
});
