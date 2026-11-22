# Fix: View Transactions Button Not Working

## Problem
The "View Transactions" button in the customer interface was not working. When customers clicked it, they got a permission denied error.

## Root Cause
The **Customer role was missing the `transactions.view` permission**. 

Looking at the permissions setup in `src/migrations/003_create_permissions.sql`:
- The `transactions.view` permission existed in the system
- It was assigned to **Cashier/Teller** role only
- Customer role had: `accounts.view.own`, `transfers.internal`, `statements.view.own`, `profile.update`
- Customer role was **missing** `transactions.view`

The route `GET /api/transactions` requires one of these permissions:
- `transactions.view`
- `everything.view`
- `ledger.view`

Since Customer had none of these, the request was blocked.

## Solution
Added `transactions.view` permission to Customer role by:

1. Created migration file: `src/migrations/012_add_customer_transactions_view.sql`
2. Created script: `scripts/add-customer-transactions-permission.js`
3. Executed the permission grant:

```sql
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Customer'
    AND p.code = 'transactions.view';
```

Result: **1 row affected** - permission successfully granted

## Verification
Customer role now has 8 permissions:
1. `accounts.view.own` - View own accounts
2. `transfers.internal` - Initiate internal transfers
3. `statements.view.own` - View own statements
4. `profile.update` - Update own profile
5. `applications.create` - Create account applications
6. `applications.view` - View account applications
7. `applications.update` - Update applications (corrections)
8. **`transactions.view`** - **View transactions** ✓ NEW

## Testing
To test the fix:
1. Log in as customer (Abebe: abebewubi1125@gmail.com or Biruk: birukie@gmail.com)
2. Click "View Transactions" button
3. Should now display transaction history with:
   - Initial deposit when account was activated
   - Any transfers made
   - Deposits/withdrawals by teller

## Files Changed
- `src/migrations/012_add_customer_transactions_view.sql` - New migration file
- `scripts/add-customer-transactions-permission.js` - Script to apply the permission

## Status
✓ **FIXED** - Customer role now has permission to view transactions

## Note
This is a **permanent fix**. The permission is now stored in the database and will persist across server restarts. Any new customers created will automatically inherit this permission from the Customer role.
