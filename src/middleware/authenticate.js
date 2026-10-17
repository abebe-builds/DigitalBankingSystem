import { pool } from '../db/pool.js';

export async function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ status: 'error', error: 'Authentication required' });
  }
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role_id, r.name AS role_name, u.status,
              u.failed_login_attempts, u.locked_until, u.last_login_at,
              u.password_changed_at, u.must_change_password, u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [req.session.user.id],
    );
    const user = rows[0];
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ status: 'error', error: 'Authentication required' });
    }
    if (user.status === 'suspended' || user.status === 'closed') {
      return res.status(403).json({ status: 'error', error: 'Account is not active' });
    }
    // password_hash is NOT selected above — safe to attach
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
