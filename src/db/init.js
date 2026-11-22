import mysql from 'mysql2/promise';
import { config } from '../config/env.js';
import { serverConfig } from '../config/db.js';

const CREATE_DB_SQL = `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`;

async function main() {
  let connection;
  try {
    connection = await mysql.createConnection(serverConfig);
    await connection.query(CREATE_DB_SQL);
    console.log(`Database '${config.db.database}' ensured (created if not exists).`);
  } catch (err) {
    console.error(`Failed to create database: ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
