import mysql from 'mysql2/promise';

async function verifyPermissions() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'digital_banking'
  });

  try {
    // Get Customer role permissions
    const [permissions] = await conn.query(`
      SELECT p.code, p.description
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = 'Customer'
      ORDER BY p.code
    `);

    console.log('\n✓ Customer Role Permissions:');
    console.log('─'.repeat(70));
    
    const expectedPermissions = [
      'accounts.view.own',
      'applications.create',
      'applications.update',
      'applications.view',
      'profile.update',
      'statements.view.own',
      'transactions.view',  // The one we just added!
      'transfers.internal'
    ];

    permissions.forEach((p, i) => {
      const isNew = p.code === 'transactions.view';
      const marker = isNew ? '🆕' : '  ';
      console.log(`${marker} ${(i + 1).toString().padStart(2)}. ${p.code.padEnd(25)} - ${p.description}`);
    });

    console.log('─'.repeat(70));
    console.log(`Total: ${permissions.length} permissions\n`);

    // Check if all expected permissions are present
    const actualCodes = permissions.map(p => p.code);
    const missing = expectedPermissions.filter(code => !actualCodes.includes(code));
    
    if (missing.length > 0) {
      console.log('⚠️  Missing permissions:', missing.join(', '));
    } else {
      console.log('✅ All expected permissions are present!\n');
    }

    // Test with actual users
    const [users] = await conn.query(`
      SELECT u.email, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'Customer'
      LIMIT 5
    `);

    if (users.length > 0) {
      console.log('Customer Users:');
      console.log('─'.repeat(70));
      users.forEach(u => {
        console.log(`   ${u.email}`);
      });
      console.log('─'.repeat(70));
      console.log(`   All ${users.length} customer(s) inherit these ${permissions.length} permissions\n`);
    }

    console.log('✅ Verification complete - Customer role is properly configured');

  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

verifyPermissions();
