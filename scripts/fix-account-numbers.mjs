/**
 * One-time script: Convert existing alphanumeric account numbers
 * to real numeric-only format like Ethiopian banks.
 */
import { pool } from '../src/db/pool.js';
import dotenv from 'dotenv';
dotenv.config();

// Get all accounts with old alphanumeric format
const [accounts] = await pool.query(
  `SELECT id, account_number, customer_user_id 
   FROM bank_accounts 
   WHERE account_number LIKE 'ETB-%'`
);

if (!accounts.length) {
  console.log('No accounts need updating. All account numbers are already numeric.');
  await pool.end();
  process.exit(0);
}

console.log(`Found ${accounts.length} account(s) with old format. Converting to numeric...\n`);

const PREFIX = '1000'; // Bank branch code
const usedNumbers = new Set();

for (const account of accounts) {
  // Generate unique 13-digit number
  let newNumber;
  let attempts = 0;
  
  while (attempts < 100) {
    let randomDigits = '';
    for (let i = 0; i < 9; i++) {
      randomDigits += Math.floor(Math.random() * 10);
    }
    newNumber = PREFIX + randomDigits;
    
    // Check if already used in this session or database
    if (!usedNumbers.has(newNumber)) {
      const [existing] = await pool.query(
        'SELECT id FROM bank_accounts WHERE account_number = ?',
        [newNumber]
      );
      if (existing.length === 0) {
        usedNumbers.add(newNumber);
        break;
      }
    }
    attempts++;
  }
  
  if (attempts >= 100) {
    console.error(`❌ Failed to generate unique number for account ${account.id}`);
    continue;
  }
  
  // Update the account
  await pool.query(
    'UPDATE bank_accounts SET account_number = ? WHERE id = ?',
    [newNumber, account.id]
  );
  
  console.log(`✅ Account ${account.id}: ${account.account_number} → ${newNumber}`);
}

await pool.end();
console.log('\n✅ All accounts updated to numeric format!');
