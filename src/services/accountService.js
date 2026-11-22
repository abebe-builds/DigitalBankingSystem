import { pool } from '../db/pool.js';
import { postDeposit } from './ledgerService.js';

export async function getAccountById(accountId, requestingUserId, requestingRole) {
  const [rows] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [accountId]);
  if (rows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
  const account = rows[0];
  // Customers can only see their own accounts
  if (requestingRole === 'Customer' && account.customer_user_id !== requestingUserId) {
    throw Object.assign(new Error('Account not found'), { status: 404 });
  }
  return account;
}

export async function getAccountsByCustomer(customerId) {
  const [rows] = await pool.query(
    'SELECT * FROM bank_accounts WHERE customer_user_id = ? ORDER BY created_at DESC',
    [customerId],
  );
  return rows;
}

export async function activateAccount(accountId, activatorId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [accountId]);
    if (rows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
    const account = rows[0];
    if (account.status !== 'PENDING_ACTIVATION') {
      throw Object.assign(new Error(`Cannot activate account with status ${account.status}`), { status: 409 });
    }
    await conn.query(
      'UPDATE bank_accounts SET status = ?, opened_at = NOW() WHERE id = ?',
      ['ACTIVE', accountId],
    );
    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [activatorId, 'ACCOUNT_ACTIVATED', 'bank_account', accountId,
        JSON.stringify({ status: account.status }),
        JSON.stringify({ status: 'ACTIVE' })],
    );
    await conn.commit();
    conn.release();

    // If the linked application has an initial_deposit_amount > 0, post it now.
    // This mirrors real bank practice: the opening deposit is posted on activation.
    // Splits into chunks if amount exceeds the single-transaction limit (20,000 ETB for SAVINGS).
    if (account.application_id) {
      try {
        const [appRows] = await pool.query(
          'SELECT initial_deposit_amount FROM account_applications WHERE id = ?',
          [account.application_id],
        );
        let remaining = appRows[0] ? Math.round(parseFloat(appRows[0].initial_deposit_amount) * 100) / 100 : 0;
        if (remaining > 0) {
          const CHUNK = 19999.99; // stays below 20,000 SAVINGS single-tx limit
          let chunkNum = 1;
          while (remaining > 0) {
            const thisChunk = Math.min(remaining, CHUNK);
            await postDeposit(
              accountId,
              thisChunk,
              `Initial deposit on account opening${chunkNum > 1 ? ` (part ${chunkNum})` : ''}`,
              activatorId,
              `initial-deposit-${accountId}-${chunkNum}`,
            );
            remaining = Math.round((remaining - thisChunk) * 100) / 100;
            chunkNum++;
          }
        }
      } catch (depositErr) {
        console.error(`[activateAccount] Initial deposit failed for account ${accountId}:`, depositErr.message);
      }
    }

    const [updated] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [accountId]);
    return updated[0];
  } catch (err) {
    try { conn.release(); } catch {}
    throw err;
  }
}

export async function suspendAccount(accountId, operatorId, reason) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [accountId]);
    if (rows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
    const account = rows[0];
    if (account.status !== 'ACTIVE') {
      throw Object.assign(new Error(`Cannot suspend account with status ${account.status}`), { status: 409 });
    }
    await conn.query('UPDATE bank_accounts SET status = ? WHERE id = ?', ['SUSPENDED', accountId]);
    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [operatorId, 'ACCOUNT_SUSPENDED', 'bank_account', accountId,
        JSON.stringify({ status: account.status }),
        JSON.stringify({ status: 'SUSPENDED', reason })],
    );
    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [accountId]);
    return updated[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function closeAccount(accountId, operatorId, reason) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT * FROM bank_accounts WHERE id = ? FOR UPDATE', [accountId]);
    if (rows.length === 0) throw Object.assign(new Error('Account not found'), { status: 404 });
    const account = rows[0];
    if (!['ACTIVE', 'SUSPENDED'].includes(account.status)) {
      throw Object.assign(new Error(`Cannot close account with status ${account.status}`), { status: 409 });
    }
    if (parseFloat(account.balance) !== 0) {
      throw Object.assign(new Error('Cannot close account with non-zero balance'), { status: 409 });
    }
    await conn.query(
      'UPDATE bank_accounts SET status = ?, closed_at = NOW() WHERE id = ?',
      ['CLOSED', accountId],
    );
    await conn.query(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?)',
      [operatorId, 'ACCOUNT_CLOSED', 'bank_account', accountId,
        JSON.stringify({ status: account.status }),
        JSON.stringify({ status: 'CLOSED', reason })],
    );
    await conn.commit();
    const [updated] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [accountId]);
    return updated[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
