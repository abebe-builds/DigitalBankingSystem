import mysql from 'mysql2/promise';
import fs from 'fs';

async function applyMigration() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'digital_banking'
  });

  try {
    // Add columns one by one
    try {
      await conn.query('ALTER TABLE account_applications ADD COLUMN kyc_verified_by INT DEFAULT NULL');
      console.log('✓ Added kyc_verified_by column');
    } catch (e) {
      if (e.errno === 1060) console.log('  kyc_verified_by already exists');
      else throw e;
    }

    try {
      await conn.query('ALTER TABLE account_applications ADD COLUMN kyc_verified_at TIMESTAMP NULL DEFAULT NULL');
      console.log('✓ Added kyc_verified_at column');
    } catch (e) {
      if (e.errno === 1060) console.log('  kyc_verified_at already exists');
      else throw e;
    }

    try {
      await conn.query('ALTER TABLE account_applications ADD COLUMN kyc_notes TEXT DEFAULT NULL');
      console.log('✓ Added kyc_notes column');
    } catch (e) {
      if (e.errno === 1060) console.log('  kyc_notes already exists');
      else throw e;
    }

    try {
      await conn.query('CREATE INDEX idx_kyc_verified ON account_applications(kyc_verified_by, kyc_verified_at)');
      console.log('✓ Created index idx_kyc_verified');
    } catch (e) {
      if (e.errno === 1061) console.log('  Index already exists');
      else throw e;
    }

    console.log('\n✅ Migration 013 completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

applyMigration();
