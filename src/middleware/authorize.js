import { pool } from '../db/pool.js';

async function loadRolePermissions(req) {
  if (!req._rolePerms) {
    const [rows] = await pool.query(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [req.user.role_id],
    );
    req._rolePerms = new Set(rows.map((r) => r.code));
  }
  return req._rolePerms;
}

export function requirePermission(...codes) {
  return async (req, res, next) => {
    try {
      const perms = await loadRolePermissions(req);
      const allowed = codes.some((c) => perms.has(c));
      if (!allowed) {
        return res.status(403).json({ status: 'error', error: 'Insufficient permissions' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roleNames) {
  return (req, res, next) => {
    if (!roleNames.includes(req.user?.role_name)) {
      return res.status(403).json({ status: 'error', error: 'Insufficient permissions' });
    }
    next();
  };
}
