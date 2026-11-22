# Fix: Teller Deposit/Withdrawal Account Number Support

## Problem
When the teller entered the 13-digit account number (e.g., `1000335388582`) in the deposit/withdrawal forms, the system showed **"Account not found"** error.

## Root Cause
The teller deposit and withdrawal routes only accepted **account IDs** (internal database IDs like 1, 2, 3), but the teller was entering **account numbers** (the 13-digit customer-facing numbers).

### Previous Code (Deposit Route)
```javascript
// Only accepted account IDs
const { accountId, amount, description, idempotencyKey } = req.body;
const result = await postDeposit(parseInt(accountId), ...);
```

The transfer route was already fixed to accept account numbers, but deposit/withdrawal were not updated.

## Solution
Updated both **deposit** and **withdrawal** routes in `src/routes/transactions.js` to convert account numbers to account IDs, using the same logic as the transfer route:

### New Code
```javascript
let { accountId, amount, description, idempotencyKey } = req.body;

// Convert account number to account ID if needed (13-digit numeric string)
if (typeof accountId === 'string' && accountId.length > 10) {
  const [rows] = await pool.query('SELECT id FROM bank_accounts WHERE account_number = ?', [accountId]);
  if (rows.length === 0) {
    return res.status(404).json({ status: 'error', error: 'Account not found' });
  }
  accountId = rows[0].id;
} else {
  accountId = parseInt(accountId);
}

const result = await postDeposit(accountId, Number(amount), description, req.user.id, idempotencyKey);
```

### Logic
1. **Check if input is account number**: If `accountId` is a string with length > 10, assume it's an account number
2. **Query database**: Look up the account by `account_number` field
3. **Return 404 if not found**: Clear error message
4. **Use account ID**: Convert to internal ID and proceed
5. **Fallback**: If not an account number, parse as integer (for backward compatibility)

## UI Update
Also updated the cashier frontend (`public/js/views/cashier.js`) to make it clearer:

### Before
```html
<label for="dep-account">Account ID</label>
<input placeholder="Account ID" />
```

### After
```html
<label for="dep-account">Account Number</label>
<input placeholder="13-digit account number" />
```

Now tellers know to enter the 13-digit account number they see on the customer's account card.

## Files Changed
1. `src/routes/transactions.js` - Added account number conversion to deposit & withdrawal routes
2. `public/js/views/cashier.js` - Changed labels from "Account ID" to "Account Number"

## Testing
To test:
1. Log in as teller/cashier (cashier@dev.local)
2. Go to "Teller Ops" view
3. Enter account number: `1000335388582` (Biruk's account)
4. Enter amount: `1888` ETB
5. Click "Deposit"
6. Should show success receipt with transaction details

Withdrawal works the same way.

## Verification
Both routes now support:
- ✅ **Account numbers** (13 digits): `1000335388582` → looks up in DB → converts to ID
- ✅ **Account IDs** (fallback): `1`, `2`, `3` → parses as integer (for API backward compatibility)

## Status
✓ **FIXED** - Teller can now use 13-digit account numbers for deposits and withdrawals

This completes the account number migration. All routes now accept account numbers:
- ✅ Transfers (fixed earlier)
- ✅ Deposits (just fixed)
- ✅ Withdrawals (just fixed)
