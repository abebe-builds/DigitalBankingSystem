/**
 * One-time fix: post initial deposits for accounts that were activated
 * before the auto-deposit feature was deployed.
 * Finds ACTIVE accounts where balance=0 but application has initial_deposit_amount > 0.
 */
import { postDeposit } from '../src/services/ledgerService.js';
import { pool } from '../src/db/pool.js';
import dotenv from 'dotenv';
dotenv.config();

const [rows] = await pool.query(`
  SELECT ba.id AS account_id, ba.account_number, ba.customer_user_id,
         aa.initial_deposit_amount, aa.id AS app_id
  FROM bank_accounts ba
  JOIN account_applications aa ON aa.id = ba.application_id
  WHERE ba.status = 'ACTIVE'
    AND ba.balance = 0
    AND aa.initial_deposit_amount > 0
`);

if (!rows.length) {
  console.log('No accounts need fixing.');
  process.exit(0);
}

console.log(`Found ${rows.length} account(s) needing initial deposit...\n`);

for (const row of rows) {
  try {
    const amount = Number(row.initial_deposit_amount);
    // SAVINGS single-transaction limit is 20,000 ETB
    // Split large deposits into chunks if needed
    const CHUNK = 19999.99;
    let remaining = amount;
    let chunkNum  = 1;

    while (remaining > 0) {
      const thisChunk = Math.min(remaining, CHUNK);
      const idempKey  = `initial-deposit-${row.account_id}-${chunkNum}`;
      const result = await postDeposit(
        row.account_id,
        thisChunk,
        `Initial deposit on account opening${chunkNum > 1 ? ` (part ${chunkNum})` : ''}`,
        row.customer_user_id,
        idempKey,
      );
      console.log(`✅ Account ${row.account_number}: chunk ${chunkNum} — posted ETB ${thisChunk.toLocaleString()} — txn ${result.transaction.reference_number}`);
      remaining = Math.round((remaining - thisChunk) * 100) / 100;
      chunkNum++;
    }
    console.log(`   Total posted: ETB ${amount.toLocaleString()}`);
  } catch (err) {
    if (err.message?.includes('duplicate') || err.code === 'ER_DUP_ENTRY') {
      console.log(`⏭️  Account ${row.account_number}: already has initial deposit (idempotency key exists)`);
    } else {
      console.error(`❌ Account ${row.account_number}: ${err.message}`);
    }
  }
}

await pool.end();
console.log('\nDone.');
