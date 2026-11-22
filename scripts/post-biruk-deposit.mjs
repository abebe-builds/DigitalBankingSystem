import { postDeposit } from '../src/services/ledgerService.js';
import { pool } from '../src/db/pool.js';
import dotenv from 'dotenv';
dotenv.config();

// Post Biruk's missing initial deposit
const accountId = 168; // Biruk's account
const amount = 10000.00;
const description = 'Initial deposit on account opening';
const operatorId = 2; // manager user ID
const idempotencyKey = `initial-deposit-${accountId}-1`;

try {
  await postDeposit(accountId, amount, description, operatorId, idempotencyKey);
  console.log(`✅ Posted ETB ${amount} to account ${accountId}`);
  
  // Verify balance
  const [rows] = await pool.query('SELECT account_number, balance FROM bank_accounts WHERE id = ?', [accountId]);
  console.log(`   New balance: ETB ${rows[0].balance}`);
} catch (err) {
  console.error(`❌ Error: ${err.message}`);
}

await pool.end();
