import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { pool } from '../db/pool.js';

export const usersRouter = Router();

// GET /api/users — list users (paginated)
usersRouter.get('/', requireAuth, requirePermission('users.view'), async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role_id, r.name AS role_name, u.status,
              u.last_login_at, u.created_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.id
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    return res.status(200).json({ status: 'ok', users: rows, total, limit, offset });
  } catch (err) {
    next(err);
  }
});
