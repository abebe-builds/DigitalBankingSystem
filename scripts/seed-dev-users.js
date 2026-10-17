import { config } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';
import bcrypt from 'bcryptjs';

if (config.isProduction) {
  console.error('REFUSED: seed:dev must not run in production.');
  process.exit(1);
}

console.log('=== DEVELOPMENT ONLY — seeding dev users ===');

const DEV_PASSWORD = 'DevPass123!';

const ROLES = [
  'Customer',
  'Account Opening Employee',
  'KYC/Compliance Officer',
  'Manager/Authorized Approver',
  'Cashier/Teller',
  'Customer Support',
  'Auditor',
  'Operations/Finance',
  'System Administrator',
];

const EMAIL_MAP = {
  'Customer': 'customer@dev.local',
  'Account Opening Employee': 'account-opening@dev.local',
  'KYC/Compliance Officer': 'kyc-officer@dev.local',
  'Manager/Authorized Approver': 'manager@dev.local',
  'Cashier/Teller': 'cashier@dev.local',
  'Customer Support': 'support@dev.local',
  'Auditor': 'auditor@dev.local',
  'Operations/Finance': 'operations@dev.local',
  'System Administrator': 'sysadmin@dev.local',
};

(async () => {
  try {
    const hash = await bcrypt.hash(DEV_PASSWORD, config.bcryptRounds);
    const [roles] = await pool.query('SELECT id, name FROM roles WHERE name IN (?)', [ROLES]);
    for (const role of roles) {
      const email = EMAIL_MAP[role.name];
      if (!email) continue;
      await pool.query(
        'INSERT IGNORE INTO users (email, password_hash, role_id) VALUES (?, ?, ?)',
        [email, hash, role.id],
      );
      console.log(`  Seeded: ${email} (${role.name})`);
    }
    console.log(`\nDev password for all users: ${DEV_PASSWORD}`);
    console.log('Seed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
