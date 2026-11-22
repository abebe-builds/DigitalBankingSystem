/**
 * deploy-check.js — pre-deployment readiness checklist.
 * Reports PASS/FAIL for each critical configuration item.
 *
 * Usage: node scripts/deploy-check.js
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let passed = 0;
let failed = 0;

function check(label, result, detail = '') {
  const status = result ? '✔ PASS' : '✖ FAIL';
  const symbol = result ? '\x1b[32m' : '\x1b[31m';
  const reset  = '\x1b[0m';
  console.log(`${symbol}${status}${reset}  ${label}${detail ? `  (${detail})` : ''}`);
  if (result) passed++; else failed++;
}

async function run() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  DigitalBank ETB — Deployment Readiness Check   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // 1. SESSION_SECRET
  const secret = process.env.SESSION_SECRET || '';
  const secretOk = secret.length > 0 && secret !== 'change-me-in-production';
  check('SESSION_SECRET is set and not the default placeholder',
    secretOk,
    secretOk ? 'secret is configured' : 'set SESSION_SECRET in .env');

  // 2. NODE_ENV
  const nodeEnv = process.env.NODE_ENV || '';
  check('NODE_ENV is set',
    nodeEnv.length > 0,
    nodeEnv || 'not set — defaults to development');

  // 3. COOKIE_SECURE for production
  if (nodeEnv === 'production') {
    const cookieSecure = process.env.COOKIE_SECURE === 'true';
    check('COOKIE_SECURE=true in production', cookieSecure,
      cookieSecure ? '' : 'set COOKIE_SECURE=true in production .env');
  } else {
    check('COOKIE_SECURE check (skipped in non-production)',
      true, `NODE_ENV=${nodeEnv}`);
  }

  // 4. Database reachable
  let dbOk = false;
  try {
    const conn = await mysql.createConnection({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '3306'),
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'digital_banking',
    });
    await conn.query('SELECT 1');
    await conn.end();
    dbOk = true;
  } catch (e) {
    // fall through
  }
  check('Database is reachable', dbOk,
    dbOk ? `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}` : 'cannot connect to MySQL');

  // 5. No pending migrations
  let migrationsOk = false;
  let pendingCount = 0;
  if (dbOk) {
    try {
      const { getStatus } = await import('../src/db/migrate.js');
      const status = await getStatus();
      pendingCount = status.pending.length;
      migrationsOk = pendingCount === 0;
    } catch {
      // ignore
    }
  }
  check('All migrations are applied (no pending)',
    migrationsOk,
    migrationsOk ? '' : `${pendingCount} pending migration(s) — run: npm run migrate`);

  // 6. Rate limits configured
  const rateLimitApi   = parseInt(process.env.RATE_LIMIT_MAX_API   || '500');
  const rateLimitLogin = parseInt(process.env.RATE_LIMIT_MAX_LOGIN || '50');
  const rateLimitsOk   = rateLimitApi <= 200 && rateLimitLogin <= 20;
  check('Rate limits are production-appropriate (≤200 API, ≤20 login)',
    rateLimitsOk,
    rateLimitsOk
      ? `API=${rateLimitApi} login=${rateLimitLogin}`
      : `API=${rateLimitApi} login=${rateLimitLogin} — tighten in production .env`);

  // 7. uploads/ directory
  const uploadsDir = join(ROOT, process.env.UPLOAD_DIR || 'uploads');
  const uploadsOk  = existsSync(uploadsDir);
  if (!uploadsOk) { try { mkdirSync(uploadsDir, { recursive: true }); } catch {} }
  check('uploads/ directory exists or was created',
    existsSync(uploadsDir), uploadsDir);

  // 8. backups/ directory
  const backupsDir = join(ROOT, 'backups');
  const backupsOk  = existsSync(backupsDir);
  if (!backupsOk) { try { mkdirSync(backupsDir, { recursive: true }); } catch {} }
  check('backups/ directory exists or was created',
    existsSync(backupsDir), backupsDir);

  // 9. CORS_ORIGIN set for production
  const corsOrigin = process.env.CORS_ORIGIN || '';
  if (nodeEnv === 'production') {
    check('CORS_ORIGIN is set for production', corsOrigin.length > 0,
      corsOrigin || 'set CORS_ORIGIN to your frontend domain in production .env');
  } else {
    check('CORS_ORIGIN check (skipped in non-production)',
      true, `will need setting in production`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────');
  const total = passed + failed;
  if (failed === 0) {
    console.log(`\x1b[32m✔ All ${total} checks passed. Ready to deploy.\x1b[0m`);
  } else {
    console.log(`\x1b[31m✖ ${failed}/${total} check(s) failed. Fix before deploying.\x1b[0m`);
    process.exit(1);
  }
  console.log('');
  process.exit(0);
}

run().catch(err => {
  console.error('Deploy check error:', err.message);
  process.exit(1);
});
