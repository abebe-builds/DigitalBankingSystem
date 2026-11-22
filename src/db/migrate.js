import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { dbConfig } from '../config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

const SCHEMA_MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

function listMigrationFiles() {
  let entries = [];
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ filename: f, path: join(MIGRATIONS_DIR, f) }));
}

async function ensureMigrationsTable(conn) {
  await conn.query(SCHEMA_MIGRATIONS_SQL);
}

async function getAppliedFilenames(conn) {
  const [rows] = await conn.query('SELECT filename FROM schema_migrations ORDER BY filename');
  return new Set(rows.map((r) => r.filename));
}

// Applies all pending migrations. Returns { applied: string[], skipped: number }.
export async function runMigrations() {
  let conn;
  try {
    conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  } catch (err) {
    console.error(`Migration runner cannot connect to database: ${err.message}`);
    throw err;
  }
  try {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedFilenames(conn);
    const files = listMigrationFiles();
    const appliedNow = [];
    for (const f of files) {
      if (applied.has(f.filename)) continue;
      const sql = readFileSync(f.path, 'utf8');
      try {
        // MySQL/MariaDB implicitly commits DDL, so a transaction wrapper cannot make a
        // migration atomic. Each migration file must therefore be safe to retry: idempotent
        // DDL (IF NOT EXISTS / IF EXISTS) and idempotent DML (ON DUPLICATE KEY / WHERE NOT EXISTS).
        // The filename is recorded only after a successful apply, so a failed migration is
        // retried on the next run instead of being silently skipped.
        await conn.query(sql); // multipleStatements enabled -> runs the whole file
        await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [f.filename]);
        appliedNow.push(f.filename);
        console.log(`Applied migration: ${f.filename}`);
      } catch (err) {
        console.error(`Migration FAILED: ${f.filename} - ${err.message}`);
        throw err;
      }
    }
    return { applied: appliedNow, skipped: files.length - appliedNow.length };
  } finally {
    await conn.end();
  }
}

// Returns { applied: string[], pending: string[] }.
export async function getStatus() {
  const conn = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
  try {
    await ensureMigrationsTable(conn);
    const appliedSet = await getAppliedFilenames(conn);
    const files = listMigrationFiles();
    return {
      applied: files.filter((f) => appliedSet.has(f.filename)).map((f) => f.filename),
      pending: files.filter((f) => !appliedSet.has(f.filename)).map((f) => f.filename),
    };
  } finally {
    await conn.end();
  }
}

// Only act when run directly (npm run migrate / migrate:status). Importing in tests is side-effect free.
const isMainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMainModule) {
  const statusOnly = process.argv.slice(2).includes('--status');
  (async () => {
    try {
      if (statusOnly) {
        const s = await getStatus();
        console.log('Applied migrations:', s.applied.length ? s.applied.join(', ') : '(none)');
        console.log('Pending migrations:', s.pending.length ? s.pending.join(', ') : '(none)');
      } else {
        const r = await runMigrations();
        console.log(`Migrations complete. Applied: ${r.applied.length}, Skipped: ${r.skipped}.`);
      }
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })();
}
