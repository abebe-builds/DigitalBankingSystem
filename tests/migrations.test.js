import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config/env.js';

// Pool teardown is handled by tests/teardown.test.js which runs last (alphabetically).
// This file does NOT close the pool.

const EXPECTED_ROLES = [
  'Customer',
  'Account Opening Employee',
  'KYC/Compliance Officer',
  'Manager/Authorized Approver',
  'Cashier/Teller',
  'Customer Support',
  'Auditor',
  'Operations/Finance',
  'System Administrator',
];

async function ensureDb(t) {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch (e) {
    t.skip(`BLOCKED: MySQL unreachable - ${e.message}`);
    return false;
  }
}

test('migrations idempotent and roles seeded', async (t) => {
  if (!(await ensureDb(t))) return;

  // Apply migrations (idempotent: applies pending, skips applied).
  await runMigrations();

  // schema_migrations table exists.
  const [tbl] = await pool.query(
    'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
    [config.db.database, 'schema_migrations']
  );
  assert.equal(tbl[0].c, 1, 'schema_migrations table should exist');

  // Idempotent: running again must not add rows.
  const [before] = await pool.query('SELECT COUNT(*) AS c FROM schema_migrations');
  await runMigrations();
  const [after] = await pool.query('SELECT COUNT(*) AS c FROM schema_migrations');
  assert.equal(after[0].c, before[0].c, 'rerunning migrate must not add schema_migrations rows');

  // roles: exactly 9 rows containing the expected names.
  const [roles] = await pool.query('SELECT name FROM roles ORDER BY id');
  assert.equal(roles.length, 9, 'roles table should have exactly 9 rows');
  const names = roles.map((r) => r.name);
  for (const expected of EXPECTED_ROLES) {
    assert.ok(names.includes(expected), `missing expected role: ${expected}`);
  }
});
