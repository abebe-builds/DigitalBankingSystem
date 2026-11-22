import mysql from 'mysql2/promise';
import { dbConfig } from '../config/db.js';

export const pool = mysql.createPool(dbConfig);

// Runs SELECT 1 and returns a clear ok/fail result. Never throws.
export async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 AS one');
    if (Array.isArray(rows) && rows[0] && rows[0].one === 1) {
      return { ok: true, message: `Database connection OK (${dbConfig.host}:${dbConfig.port}/${dbConfig.database})` };
    }
    return { ok: false, message: 'Database connection check returned an unexpected result.' };
  } catch (err) {
    return { ok: false, message: `Database connection FAILED: ${err.message}` };
  }
}

export default pool;
