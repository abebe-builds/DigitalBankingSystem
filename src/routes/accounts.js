import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import {
  getAccountById,
  getAccountsByCustomer,
  activateAccount,
  suspendAccount,
  closeAccount,
} from '../services/accountService.js';
import { pool } from '../db/pool.js';

export const accountsRouter = Router();

// GET /api/accounts — list all (paginated); privileged only
accountsRouter.get('/', requireAuth, requirePermission('accounts.view', 'accounts.view.limited', 'everything.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [rows] = await pool.query('SELECT * FROM bank_accounts ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM bank_accounts');
    res.json({ status: 'ok', data: rows, pagination: { page, limit, total: Number(total) } });
  } catch (err) { next(err); }
});

// GET /api/accounts/my — customer sees own accounts
accountsRouter.get('/my', requireAuth, async (req, res, next) => {
  try {
    const accounts = await getAccountsByCustomer(req.user.id);
    res.json({ status: 'ok', data: accounts });
  } catch (err) { next(err); }
});

// GET /api/accounts/:id — ownership/role check
accountsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const account = await getAccountById(parseInt(req.params.id), req.user.id, req.user.role_name);
    res.json({ status: 'ok', data: account });
  } catch (err) { next(err); }
});

// POST /api/accounts/:id/activate
accountsRouter.post('/:id/activate', requireAuth, requirePermission('accounts.view'), async (req, res, next) => {
  try {
    const account = await activateAccount(parseInt(req.params.id), req.user.id);
    res.json({ status: 'ok', data: account });
  } catch (err) { next(err); }
});

// POST /api/accounts/:id/suspend
accountsRouter.post('/:id/suspend', requireAuth, requirePermission('accounts.view'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const account = await suspendAccount(parseInt(req.params.id), req.user.id, reason);
    res.json({ status: 'ok', data: account });
  } catch (err) { next(err); }
});

// POST /api/accounts/:id/close
accountsRouter.post('/:id/close', requireAuth, requirePermission('accounts.view'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const account = await closeAccount(parseInt(req.params.id), req.user.id, reason);
    res.json({ status: 'ok', data: account });
  } catch (err) { next(err); }
});
