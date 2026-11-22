/**
 * backup-db.js — dumps the digital_banking database to a timestamped SQL file.
 * Uses mysqldump via child_process (no mysql2 dependency for the dump itself).
 *
 * Usage:  node scripts/backup-db.js
 * Output: backups/digital_banking_YYYYMMDD_HHMMSS.sql
 */
import { execFile } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

dotenv.config();

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BACKUPS_DIR = join(ROOT, 'backups');

// Detect mysqldump location
const MYSQLDUMP = process.env.MYSQLDUMP_PATH ||
  (process.platform === 'win32'
    ? 'C:\\xampp\\mysql\\bin\\mysqldump.exe'
    : 'mysqldump');

function timestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${date}_${time}`;
}

async function backup() {
  const dbName   = process.env.DB_NAME   || 'digital_banking';
  const dbHost   = process.env.DB_HOST   || 'localhost';
  const dbPort   = process.env.DB_PORT   || '3306';
  const dbUser   = process.env.DB_USER   || 'root';
  const dbPass   = process.env.DB_PASSWORD || '';

  if (!existsSync(BACKUPS_DIR)) {
    mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`Created backups directory: ${BACKUPS_DIR}`);
  }

  const outFile = join(BACKUPS_DIR, `${dbName}_${timestamp()}.sql`);

  const args = [
    `--host=${dbHost}`,
    `--port=${dbPort}`,
    `--user=${dbUser}`,
    `--single-transaction`,
    `--routines`,
    `--triggers`,
    `--result-file=${outFile}`,
    dbName,
  ];
  if (dbPass) args.unshift(`--password=${dbPass}`);

  console.log(`Backing up database '${dbName}' to: ${outFile}`);

  try {
    await execFileAsync(MYSQLDUMP, args);
    const { statSync } = await import('node:fs');
    const size = statSync(outFile).size;
    if (size < 100) throw new Error(`Backup file suspiciously small (${size} bytes)`);
    console.log(`Backup complete. File size: ${(size / 1024).toFixed(1)} KB`);
    console.log(`Backup file: ${outFile}`);
    return outFile;
  } catch (err) {
    console.error(`Backup FAILED: ${err.message}`);
    process.exit(1);
  }
}

backup();
