import { pool } from '../db/pool.js';
import { verifyLedgerBalance } from './ledgerService.js';

export async function runReconciliation() {
  const [accounts] = await pool.query("SELECT id, account_number FROM bank_accounts WHERE status = 'ACTIVE'");
  const results = [];
  let balanced = 0;
  const discrepancies = [];
  for (const acct of accounts) {
    const check = await verifyLedgerBalance(acct.id);
    results.push({ accountId: acct.id, accountNumber: acct.account_number, ...check });
    if (check.balanced) {
      balanced++;
    } else {
      discrepancies.push({ accountId: acct.id, accountNumber: acct.account_number, ...check });
    }
  }
  return { total: accounts.length, balanced, discrepancies };
}

export async function getTellerSummary(tellerUserId, date) {
  let dateClause, dateParams;
  if (date) {
    dateClause = 'AND DATE(created_at) = ?';
    dateParams = [date];
  } else {
    dateClause = 'AND DATE(created_at) = CURDATE()';
    dateParams = [];
  }
  const [depositRows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM transactions
     WHERE initiated_by = ? AND transaction_type = 'DEPOSIT' AND status = 'POSTED'
     ${dateClause}`,
    [tellerUserId, ...dateParams],
  );
  const [withdrawalRows] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM transactions
     WHERE initiated_by = ? AND transaction_type = 'WITHDRAWAL' AND status = 'POSTED'
     ${dateClause}`,
    [tellerUserId, ...dateParams],
  );
  
  const totalDeposits = Number(depositRows[0].total);
  const totalWithdrawals = Number(withdrawalRows[0].total);
  const depositCount = Number(depositRows[0].count);
  const withdrawalCount = Number(withdrawalRows[0].count);
  
  return {
    tellerUserId,
    date: date || new Date().toISOString().slice(0, 10),
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    transaction_count: depositCount + withdrawalCount,
    deposit_count: depositCount,
    withdrawal_count: withdrawalCount,
  };
}
