/**
 * restore-db.js — restores the digital_banking database from a backup SQL file.
 * Uses the mysql CLI via child_process.
 *
 * ⚠️  DESTRUCTIVE — this will overwrite the current database.
 *
 * Usage:  node scripts/restore-db.js backups/digital_banking_YYYYMMDD_HHMMSS.sql --confirm
 *
 * The --confirm flag is REQUIRED as a safety gate. Without it, the script exits
 * immediately to prevent accidental restoration.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

dotenv.config();

const execFileAsync = promisify(execFile);

const MYSQL = process.env.MYSQL_PATH ||
  (process.platform === 'win32'
    ? 'C:\\xampp\\mysql\\bin\\mysql.exe'
    : 'mysql');

async function restore() {
  const args = process.argv.slice(2);
  const backupFile = args.find(a => !a.startsWith('--'));
  const confirmed  = args.includes('--confirm');

  if (!backupFile) {
    console.error('Usage: node scripts/restore-db.js <backup-file.sql> --confirm');
    process.exit(1);
  }

  if (!confirmed) {
    console.error('');
    console.error('⚠️  SAFETY GATE: You must pass --confirm to restore the database.');
    console.error('   This operation OVERWRITES the current digital_banking database.');
    console.error('');
    console.error('   Example:');
    console.error('   node scripts/restore-db.js backups/digital_banking_20261018_120000.sql --confirm');
    console.error('');
    process.exit(1);
  }

  const resolvedPath = resolve(backupFile);
  if (!existsSync(resolvedPath)) {
    console.error(`Backup file not found: ${resolvedPath}`);
    process.exit(1);
  }

  const dbName = process.env.DB_NAME   || 'digital_banking';
  const dbHost = process.env.DB_HOST   || 'localhost';
  const dbPort = process.env.DB_PORT   || '3306';
  const dbUser = process.env.DB_USER   || 'root';
  const dbPass = process.env.DB_PASSWORD || '';

  const mysqlArgs = [
    `--host=${dbHost}`,
    `--port=${dbPort}`,
    `--user=${dbUser}`,
    dbName,
  ];
  if (dbPass) mysqlArgs.unshift(`--password=${dbPass}`);

  console.log(`Restoring '${dbName}' from: ${resolvedPath}`);
  console.log('This will overwrite all current data in the database.');

  try {
    // Pipe the SQL file to mysql via stdin
    const { exec } = await import('node:child_process');
    const cmd = `"${MYSQL}" ${mysqlArgs.join(' ')} < "${resolvedPath}"`;
    await new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve(stdout);
      });
    });
    console.log('Restore complete.');
  } catch (err) {
    console.error(`Restore FAILED: ${err.message}`);
    process.exit(1);
  }
}

restore();
