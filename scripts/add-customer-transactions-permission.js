import mysql from 'mysql2/promise';

async function addPermission() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'digital_banking'
  });

  try {
    const sql = `
      INSERT IGNORE INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r, permissions p
      WHERE r.name = 'Customer'
        AND p.code = 'transactions.view';
    `;
    
    const [result] = await conn.query(sql);
    console.log('✓ Added transactions.view permission to Customer role');
    console.log(`  Rows affected: ${result.affectedRows}`);
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

addPermission();
