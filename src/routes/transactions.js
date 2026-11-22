import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import {
  postDeposit,
  postWithdrawal,
  postInternalTransfer,
  postReversal,
} from '../services/ledgerService.js';
import { pool } from '../db/pool.js';

export const transactionsRouter = Router();

// POST /api/transactions/deposit
transactionsRouter.post('/deposit', requireAuth, requirePermission('teller.deposit'), async (req, res, next) => {
  try {
    let { accountId, amount, description, idempotencyKey } = req.body;
    if (!accountId || amount === undefined) return res.status(400).json({ status: 'error', error: 'accountId and amount are required' });
    
    // Convert account number to account ID if needed (13-digit numeric string)
    if (typeof accountId === 'string' && accountId.length > 10) {
      const [rows] = await pool.query('SELECT id FROM bank_accounts WHERE account_number = ?', [accountId]);
      if (rows.length === 0) {
        return res.status(404).json({ status: 'error', error: 'Account not found' });
      }
      accountId = rows[0].id;
    } else {
      accountId = parseInt(accountId);
    }
    
    const result = await postDeposit(accountId, Number(amount), description, req.user.id, idempotencyKey || null);
    const statusCode = result.idempotent ? 200 : 201;
    res.status(statusCode).json({ status: 'ok', data: result });
  } catch (err) { next(err); }
});

// POST /api/transactions/withdrawal
transactionsRouter.post('/withdrawal', requireAuth, requirePermission('teller.withdraw'), async (req, res, next) => {
  try {
    let { accountId, amount, description, idempotencyKey } = req.body;
    if (!accountId || amount === undefined) return res.status(400).json({ status: 'error', error: 'accountId and amount are required' });
    
    // Convert account number to account ID if needed (13-digit numeric string)
    if (typeof accountId === 'string' && accountId.length > 10) {
      const [rows] = await pool.query('SELECT id FROM bank_accounts WHERE account_number = ?', [accountId]);
      if (rows.length === 0) {
        return res.status(404).json({ status: 'error', error: 'Account not found' });
      }
      accountId = rows[0].id;
    } else {
      accountId = parseInt(accountId);
    }
    
    const result = await postWithdrawal(accountId, Number(amount), description, req.user.id, idempotencyKey || null);
    const statusCode = result.idempotent ? 200 : 201;
    res.status(statusCode).json({ status: 'ok', data: result });
  } catch (err) { next(err); }
});

// POST /api/transactions/transfer
transactionsRouter.post('/transfer', requireAuth, requirePermission('transfers.internal', 'teller.deposit'), async (req, res, next) => {
  try {
    let { fromAccountId, toAccountId, amount, description, idempotencyKey } = req.body;
    
    if (!fromAccountId || !toAccountId || amount === undefined) {
      return res.status(400).json({ status: 'error', error: 'fromAccountId, toAccountId, and amount are required' });
    }

    // Convert account numbers to account IDs if needed
    // Check if fromAccountId is a numeric string that might be an account_number
    if (typeof fromAccountId === 'string' && fromAccountId.length > 10) {
      const [rows] = await pool.query('SELECT id FROM bank_accounts WHERE account_number = ?', [fromAccountId]);
      if (rows.length === 0) {
        return res.status(404).json({ status: 'error', error: 'Source account not found' });
      }
      fromAccountId = rows[0].id;
    } else {
      fromAccountId = parseInt(fromAccountId);
    }

    // Check if toAccountId is a numeric string that might be an account_number
    if (typeof toAccountId === 'string' && toAccountId.length > 10) {
      const [rows] = await pool.query('SELECT id FROM bank_accounts WHERE account_number = ?', [toAccountId]);
      if (rows.length === 0) {
        return res.status(404).json({ status: 'error', error: 'Destination account not found' });
      }
      toAccountId = rows[0].id;
    } else {
      toAccountId = parseInt(toAccountId);
    }

    const result = await postInternalTransfer(
      fromAccountId, toAccountId, Number(amount), description, req.user.id, idempotencyKey || null,
    );
    const statusCode = result.idempotent ? 200 : 201;
    res.status(statusCode).json({ status: 'ok', data: result });
  } catch (err) { next(err); }
});

// POST /api/transactions/reverse
transactionsRouter.post('/reverse', requireAuth, requirePermission('ledger.post'), async (req, res, next) => {
  try {
    const { transactionId, reason, idempotencyKey } = req.body;
    if (!transactionId) return res.status(400).json({ status: 'error', error: 'transactionId is required' });
    const result = await postReversal(parseInt(transactionId), reason, req.user.id, idempotencyKey || null);
    res.status(201).json({ status: 'ok', data: result });
  } catch (err) { next(err); }
});

// GET /api/transactions
transactionsRouter.get('/', requireAuth, requirePermission('transactions.view', 'everything.view', 'ledger.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM transactions';
    const params = [];
    if (req.query.accountId) {
      query += ' WHERE id IN (SELECT DISTINCT transaction_id FROM ledger_entries WHERE account_id = ?)';
      params.push(parseInt(req.query.accountId));
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const [rows] = await pool.query(query, params);
    res.json({ status: 'ok', data: rows, pagination: { page, limit } });
  } catch (err) { next(err); }
});

// GET /api/transactions/:id
transactionsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [parseInt(req.params.id)]);
    if (rows.length === 0) return res.status(404).json({ status: 'error', error: 'Transaction not found' });
    const txn = rows[0];
    const [entries] = await pool.query('SELECT * FROM ledger_entries WHERE transaction_id = ?', [txn.id]);
    res.json({ status: 'ok', data: { transaction: txn, ledgerEntries: entries } });
  } catch (err) { next(err); }
});
