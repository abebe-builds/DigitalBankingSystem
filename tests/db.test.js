import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool, testConnection } from '../src/db/pool.js';

// Pool teardown is handled by tests/teardown.test.js which runs last (alphabetically).
// This file does NOT close the pool.

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

test('pool.query(SELECT 1) resolves', async (t) => {
  if (!(await ensureDb(t))) return;
  const [rows] = await pool.query('SELECT 1 AS one');
  assert.equal(rows[0].one, 1);
});

test('testConnection() reports ok', async (t) => {
  if (!(await ensureDb(t))) return;
  const result = await testConnection();
  assert.equal(result.ok, true);
});
