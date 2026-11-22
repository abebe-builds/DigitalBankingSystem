import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { dbConfig } from '../config/db.js';
import { config } from '../config/env.js';

async function getDedicatedConn() {
  return mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
  });
}

async function generateTxnReference(conn) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let i = 0; i < 10; i++) {
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const ref = `TXN-${today}-${suffix}`;
    const [rows] = await conn.query('SELECT id FROM transactions WHERE reference_number = ?', [ref]);
    if (rows.length === 0) return ref;
  }
  throw Object.assign(new Error('Could not generate unique reference number'), { status: 500 });
}

async function getLimit(conn, accountType, limitType) {
  const [rows] = await conn.query(
    'SELECT max_amount FROM transaction_limits WHERE account_type = ? AND limit_type = ?',
    [accountType, limitType],
  );
  if (rows.length > 0) return Number(rows[0].max_amount);
  // env fallback
  if (limitType === 'SINGLE_TRANSACTION') return config.transactionLimits.maxSingleTransactionEtb;
  if (limitType === 'DAILY_WITHDRAWAL') return config.transactionLimits.maxDailyWithdrawalEtb;
  return 0;
}

async function getDailyTotalInternal(conn, accountId, txnTypes, date) {
  const placeholders = txnTypes.map(() => '?').join(',');
  let dateClause, dateParams;
  if (date) {
    dateClause = 'DATE(t.created_at) = ?';
    dateParams = [date];
  } else {
    // Use CURDATE() so date comparison is in the DB server's timezone,
    // avoiding JS UTC vs DB local-time mismatches.
    dateClause = 'DATE(t.created_at) = CURDATE()';
    dateParams = [];
  }
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN ledger_entries le ON le.transaction_id = t.id
     WHERE le.account_id = ?
       AND t.transaction_type IN (${placeholders})
       AND t.status = 'POSTED'
       AND ${dateClause}`,
    [accountId, ...txnTypes, ...dateParams],
  );
  return Number(rows[0].total);
}

export async function idempotencyCheck(idempotencyKey) {
  if (!idempotencyKey) return null;
  const conn = await getDedicatedConn();
  try {
    const [rows] = await conn.query(
      "SELECT * FROM transactions WHERE idempotency_key = ? AND status = 'POSTED'",
      [idempotencyKey],
    );
    if (rows.length > 0) {
      const txn = rows[0];
      const [entries] = await conn.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [txn.id]);
      return { transaction: txn, ledgerEntries: entries, idempotent: true };
    }
    return null;
  } finally {
    await conn.end();
  }
}

export async function getDailyTotal(accountId, limitType, date) {
  const conn = await getDedicatedConn();
  try {
    let txnTypes;
    if (limitType === 'DAILY_WITHDRAWAL') txnTypes = ['WITHDRAWAL'];
    else if (limitType === 'DAILY_TRANSFER') txnTypes = ['TRANSFER_DEBIT'];
    else txnTypes = ['DEPOSIT'];
    return await getDailyTotalInternal(conn, accountId, txnTypes, date);
  } finally {
    await conn.end();
  }
}

export async function verifyLedgerBalance(accountId) {
  const conn = await getDedicatedConn();
  try {
    const [acctRows] = await conn.query('SELECT balance FROM bank_accounts WHERE id = ?', [accountId]);
    if (acctRows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
    const storedBalance = Number(acctRows[0].balance);
    const [sumRows] = await conn.query(
      `SELECT
         COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END), 0) AS totalCredit,
         COALESCE(SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END), 0) AS totalDebit
       FROM ledger_entries WHERE account_id = ?`,
      [accountId],
    );
    const ledgerBalance = Number(sumRows[0].totalCredit) - Number(sumRows[0].totalDebit);
    const diff = Math.abs(ledgerBalance - storedBalance);
    const balanced = diff < 0.001;
    return { balanced, ledgerBalance, storedBalance, diff };
  } finally {
    await conn.end();
  }
}

export async function postDeposit(accountId, amount, description, tellerUserId, idempotencyKey) {
  const existing = idempotencyKey ? await idempotencyCheck(idempotencyKey) : null;
  if (existing) return existing;

  const conn = await getDedicatedConn();
  try {
    await conn.beginTransaction();
    // Lock account row
    const [acctRows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [accountId]);
    if (acctRows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
    const acct = acctRows[0];
    if (acct.status !== 'ACTIVE') throw Object.assign(new Error(`Account is not active (status: ${acct.status})`), { status: 400 });

    const amt = Number(amount);
    if (amt <= 0) throw Object.assign(new Error('Amount must be positive'), { status: 400 });

    // Check single-transaction limit
    const singleLimit = await getLimit(conn, acct.account_type, 'SINGLE_TRANSACTION');
    if (singleLimit > 0 && amt > singleLimit) {
      throw Object.assign(new Error(`Amount exceeds single transaction limit of ${singleLimit}`), { status: 400 });
    }

    const ref = await generateTxnReference(conn);
    const [txnResult] = await conn.query(
      'INSERT INTO transactions (reference_number, transaction_type, status, amount, currency, description, initiated_by, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ref, 'DEPOSIT', 'PENDING', amt, acct.currency, description || null, tellerUserId, idempotencyKey || null],
    );
    const txnId = txnResult.insertId;
    const newBalance = Number(acct.balance) + amt;

    await conn.query(
      'INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, running_balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [txnId, accountId, 'CREDIT', amt, newBalance, acct.currency, description || null],
    );

    await conn.query(
      'UPDATE bank_accounts SET balance = ?, available_balance = ? WHERE id = ?',
      [newBalance, newBalance, accountId],
    );
    await conn.query('UPDATE transactions SET status = ? WHERE id = ?', ['POSTED', txnId]);

    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [tellerUserId, 'DEPOSIT', 'transaction', txnId,
        JSON.stringify({ balance: acct.balance }),
        JSON.stringify({ balance: newBalance, amount: amt, reference: ref })],
    );

    await conn.commit();
    const [txnRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [txnId]);
    const [leRows] = await conn.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [txnId]);
    return { transaction: txnRows[0], ledgerEntries: leRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

export async function postWithdrawal(accountId, amount, description, tellerUserId, idempotencyKey) {
  const existing = idempotencyKey ? await idempotencyCheck(idempotencyKey) : null;
  if (existing) return existing;

  const conn = await getDedicatedConn();
  try {
    await conn.beginTransaction();
    const [acctRows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [accountId]);
    if (acctRows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
    const acct = acctRows[0];
    if (acct.status !== 'ACTIVE') throw Object.assign(new Error(`Account is not active (status: ${acct.status})`), { status: 400 });

    const amt = Number(amount);
    if (amt <= 0) throw Object.assign(new Error('Amount must be positive'), { status: 400 });

    // FIXED_DEPOSIT: reject
    if (acct.account_type === 'FIXED_DEPOSIT') {
      throw Object.assign(new Error('Fixed deposit accounts do not allow withdrawals'), { status: 400 });
    }

    // Check balance
    if (Number(acct.balance) < amt) {
      throw Object.assign(new Error('Insufficient funds'), { status: 400 });
    }

    // Check single-transaction limit
    const singleLimit = await getLimit(conn, acct.account_type, 'SINGLE_TRANSACTION');
    if (singleLimit > 0 && amt > singleLimit) {
      throw Object.assign(new Error(`Amount exceeds single transaction limit of ${singleLimit}`), { status: 400 });
    }

    // Check daily withdrawal limit
    const dailyLimit = await getLimit(conn, acct.account_type, 'DAILY_WITHDRAWAL');
    if (dailyLimit > 0) {
      const todayTotal = await getDailyTotalInternal(conn, accountId, ['WITHDRAWAL'], null);
      if (todayTotal + amt > dailyLimit) {
        throw Object.assign(new Error(`Daily withdrawal limit of ${dailyLimit} would be exceeded`), { status: 400 });
      }
    }

    const ref = await generateTxnReference(conn);
    const [txnResult] = await conn.query(
      'INSERT INTO transactions (reference_number, transaction_type, status, amount, currency, description, initiated_by, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ref, 'WITHDRAWAL', 'PENDING', amt, acct.currency, description || null, tellerUserId, idempotencyKey || null],
    );
    const txnId = txnResult.insertId;
    const newBalance = Number(acct.balance) - amt;

    await conn.query(
      'INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, running_balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [txnId, accountId, 'DEBIT', amt, newBalance, acct.currency, description || null],
    );
    await conn.query(
      'UPDATE bank_accounts SET balance = ?, available_balance = ? WHERE id = ?',
      [newBalance, newBalance, accountId],
    );
    await conn.query('UPDATE transactions SET status = ? WHERE id = ?', ['POSTED', txnId]);
    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [tellerUserId, 'WITHDRAWAL', 'transaction', txnId,
        JSON.stringify({ balance: acct.balance }),
        JSON.stringify({ balance: newBalance, amount: amt, reference: ref })],
    );
    await conn.commit();
    const [txnRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [txnId]);
    const [leRows] = await conn.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [txnId]);
    return { transaction: txnRows[0], ledgerEntries: leRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

export async function postInternalTransfer(fromAccountId, toAccountId, amount, description, initiatedByUserId, idempotencyKey) {
  const existing = idempotencyKey ? await idempotencyCheck(idempotencyKey) : null;
  if (existing) return existing;

  if (fromAccountId === toAccountId) throw Object.assign(new Error('Cannot transfer to same account'), { status: 400 });

  const conn = await getDedicatedConn();
  try {
    await conn.beginTransaction();
    // Lock lower ID first to prevent deadlock
    const firstId = Math.min(fromAccountId, toAccountId);
    const secondId = Math.max(fromAccountId, toAccountId);
    const [firstRows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [firstId]);
    const [secondRows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [secondId]);
    if (firstRows.length === 0 || secondRows.length === 0) {
      throw Object.assign(new Error('One or both accounts not found'), { status: 404 });
    }
    const fromAcct = firstId === fromAccountId ? firstRows[0] : secondRows[0];
    const toAcct = firstId === toAccountId ? firstRows[0] : secondRows[0];

    if (fromAcct.status !== 'ACTIVE') throw Object.assign(new Error('Source account is not active'), { status: 400 });
    if (toAcct.status !== 'ACTIVE') throw Object.assign(new Error('Destination account is not active'), { status: 400 });
    if (fromAcct.currency !== toAcct.currency) throw Object.assign(new Error('Currency mismatch between accounts'), { status: 400 });

    const amt = Number(amount);
    if (amt <= 0) throw Object.assign(new Error('Amount must be positive'), { status: 400 });
    if (Number(fromAcct.balance) < amt) throw Object.assign(new Error('Insufficient funds'), { status: 400 });

    // Check single-transaction limit for source
    const singleLimit = await getLimit(conn, fromAcct.account_type, 'SINGLE_TRANSACTION');
    if (singleLimit > 0 && amt > singleLimit) {
      throw Object.assign(new Error(`Amount exceeds single transaction limit of ${singleLimit}`), { status: 400 });
    }

    // Check daily transfer limit
    const transferLimit = await getLimit(conn, fromAcct.account_type, 'DAILY_TRANSFER');
    if (transferLimit > 0) {
      const todayTransfers = await getDailyTotalInternal(conn, fromAccountId, ['TRANSFER_DEBIT'], null);
      if (todayTransfers + amt > transferLimit) {
        throw Object.assign(new Error(`Daily transfer limit of ${transferLimit} would be exceeded`), { status: 400 });
      }
    }

    const ref = await generateTxnReference(conn);
    const [txnResult] = await conn.query(
      'INSERT INTO transactions (reference_number, transaction_type, status, amount, currency, description, initiated_by, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [ref, 'TRANSFER_DEBIT', 'PENDING', amt, fromAcct.currency, description || null, initiatedByUserId, idempotencyKey || null],
    );
    const txnId = txnResult.insertId;

    const fromNewBalance = Number(fromAcct.balance) - amt;
    const toNewBalance = Number(toAcct.balance) + amt;

    // Double-entry: DEBIT source, CREDIT destination
    await conn.query(
      'INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, running_balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [txnId, fromAccountId, 'DEBIT', amt, fromNewBalance, fromAcct.currency, `Transfer to account ${toAccountId}`],
    );
    await conn.query(
      'INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, running_balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [txnId, toAccountId, 'CREDIT', amt, toNewBalance, toAcct.currency, `Transfer from account ${fromAccountId}`],
    );

    await conn.query(
      'UPDATE bank_accounts SET balance = ?, available_balance = ? WHERE id = ?',
      [fromNewBalance, fromNewBalance, fromAccountId],
    );
    await conn.query(
      'UPDATE bank_accounts SET balance = ?, available_balance = ? WHERE id = ?',
      [toNewBalance, toNewBalance, toAccountId],
    );
    await conn.query('UPDATE transactions SET status = ? WHERE id = ?', ['POSTED', txnId]);

    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [initiatedByUserId, 'TRANSFER', 'transaction', txnId,
        JSON.stringify({ fromBalance: fromAcct.balance, toBalance: toAcct.balance }),
        JSON.stringify({ fromNewBalance, toNewBalance, amount: amt, reference: ref })],
    );

    await conn.commit();
    const [txnRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [txnId]);
    const [leRows] = await conn.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [txnId]);
    return { transaction: txnRows[0], ledgerEntries: leRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

export async function postReversal(originalTransactionId, reason, operatorId, idempotencyKey) {
  const existing = idempotencyKey ? await idempotencyCheck(idempotencyKey) : null;
  if (existing) return existing;

  const conn = await getDedicatedConn();
  try {
    await conn.beginTransaction();
    // Fetch original transaction
    const [origRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [originalTransactionId]);
    if (origRows.length === 0) throw Object.assign(new Error('Transaction not found'), { status: 404 });
    const orig = origRows[0];
    if (orig.status !== 'POSTED') throw Object.assign(new Error('Only POSTED transactions can be reversed'), { status: 400 });
    if (orig.transaction_type === 'REVERSAL') throw Object.assign(new Error('Cannot reverse a reversal transaction'), { status: 400 });

    // Get original ledger entries
    const [origEntries] = await conn.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [originalTransactionId]);
    if (origEntries.length === 0) throw Object.assign(new Error('No ledger entries found for original transaction'), { status: 500 });

    // Lock affected accounts FOR UPDATE (lock lower ID first)
    const accountIds = [...new Set(origEntries.map(e => e.account_id))].sort((a, b) => a - b);
    const accountMap = {};
    for (const acctId of accountIds) {
      const [rows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [acctId]);
      if (rows.length === 0) throw Object.assign(new Error(`Account ${acctId} not found`), { status: 404 });
      accountMap[acctId] = rows[0];
    }

    const ref = await generateTxnReference(conn);
    const [revTxnResult] = await conn.query(
      'INSERT INTO transactions (reference_number, transaction_type, status, amount, currency, description, initiated_by, related_transaction_id, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ref, 'REVERSAL', 'PENDING', orig.amount, orig.currency, reason || `Reversal of ${orig.reference_number}`, operatorId, originalTransactionId, idempotencyKey || null],
    );
    const revTxnId = revTxnResult.insertId;

    // Create OPPOSITE entries and update balances
    const balanceAdjustments = {};
    for (const acctId of accountIds) balanceAdjustments[acctId] = Number(accountMap[acctId].balance);

    for (const entry of origEntries) {
      const oppositeType = entry.entry_type === 'CREDIT' ? 'DEBIT' : 'CREDIT';
      const entryAmt = Number(entry.amount);
      if (oppositeType === 'DEBIT') {
        balanceAdjustments[entry.account_id] -= entryAmt;
      } else {
        balanceAdjustments[entry.account_id] += entryAmt;
      }
      await conn.query(
        'INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount, running_balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [revTxnId, entry.account_id, oppositeType, entryAmt, balanceAdjustments[entry.account_id], entry.currency,
          `Reversal of entry ${entry.id} from transaction ${orig.reference_number}`],
      );
    }

    // Update balances
    for (const acctId of accountIds) {
      await conn.query(
        'UPDATE bank_accounts SET balance = ?, available_balance = ? WHERE id = ?',
        [balanceAdjustments[acctId], balanceAdjustments[acctId], acctId],
      );
    }

    await conn.query('UPDATE transactions SET status = ? WHERE id = ?', ['POSTED', revTxnId]);
    await conn.query('UPDATE transactions SET status = ? WHERE id = ?', ['REVERSED', originalTransactionId]);

    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [operatorId, 'REVERSAL', 'transaction', revTxnId,
        JSON.stringify({ originalTransactionId, originalStatus: orig.status }),
        JSON.stringify({ reversalReference: ref, reason })],
    );

    await conn.commit();
    const [txnRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [revTxnId]);
    const [leRows] = await conn.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [revTxnId]);
    // Re-fetch original so its status reflects the REVERSED update
    const [origUpdated] = await conn.query('SELECT * FROM transactions WHERE id = ?', [originalTransactionId]);
    return { transaction: txnRows[0], ledgerEntries: leRows, originalTransaction: origUpdated[0] };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}
