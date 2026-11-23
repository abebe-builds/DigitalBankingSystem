# Test Public Account Opening - Debug Guide

## The Issue

You're seeing "Submission failed" when trying to open an account from the public home page.

The system **DOES** have public registration - it's supposed to work!

---

## How to Test/Debug

### Step 1: Open Browser Console

1. Open your browser to: http://localhost:3000/home.html
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Click "Open an Account" button
5. Fill in the form
6. Click "Submit Application"
7. **Look at the console** - you'll see the actual error message!

### Step 2: Check Network Tab

1. In Developer Tools, go to **Network** tab
2. Click "Open an Account"
3. Fill the form and submit
4. Look for the request to: `/api/auth/register`
5. Click on it to see:
   - **Request** (what you sent)
   - **Response** (what the server said)
   - **Status Code** (should be 201 on success, 400/500 on error)

---

## Common Issues & Solutions

### Issue 1: Missing Required Fields

**Error:** "All personal information fields are required"

**Solution:** Fill in ALL fields:
- First Name
- Last Name  
- Date of Birth
- National ID
- Phone
- Email
- Address
- City
- Check "Terms Accepted"
- Check "Privacy Accepted"

### Issue 2: Password Too Weak

**Error:** "Password does not meet policy requirements"

**Solution:** Password must have:
- At least 12 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)

Example good password: `StrongPass123!`

### Issue 3: Email Already Exists

**Error:** "Email already registered"

**Solution:** Use a different email address

### Issue 4: Database Error

**Error:** "Internal server error"

**Solution:** Check the server console (PowerShell window) for error details

### Issue 5: Session Error

**Error:** "Session error"

**Solution:** Check that `.env` file has `SESSION_SECRET` set

---

## Manual Test with curl

Test the registration API directly:

```powershell
curl http://localhost:3000/api/auth/register `
  -Method POST `
  -ContentType "application/json" `
  -Body '{
    "email": "test@example.com",
    "password": "StrongPass123!",
    "first_name": "Test",
    "last_name": "User",
    "date_of_birth": "1990-01-01",
    "national_id": "ET123456789",
    "nationality": "Ethiopian",
    "phone": "+251911234567",
    "address_line1": "Bole Road",
    "address_line2": "",
    "city": "Addis Ababa",
    "account_type": "SAVINGS",
    "initial_deposit_amount": 1000,
    "currency": "ETB",
    "terms_accepted": true,
    "privacy_accepted": true
  }'
```

**Expected Response (Success):**
```json
{
  "status": "ok",
  "message": "Account created and application submitted successfully.",
  "user": {
    "id": 123,
    "email": "test@example.com",
    "role_name": "Customer"
  },
  "application": {
    "id": 1,
    "reference_number": "APP-20240115-ABCDE",
    "status": "SUBMITTED",
    "account_type": "SAVINGS"
  }
}
```

---

## What SHOULD Happen

When public registration works correctly:

1. ✅ You fill the 3-step form on home page
2. ✅ System creates a **Customer user account**
3. ✅ System creates an **account application** (status: SUBMITTED)
4. ✅ System **logs you in automatically**
5. ✅ You're redirected to customer dashboard
6. ✅ You see your application status: "Pending Review"
7. ✅ KYC officer can verify your application
8. ✅ Manager can approve it
9. ✅ Account gets created with 13-digit number

---

## Check Server Logs

Look at your PowerShell window where `npm start` is running.

You should see logs like:
- `POST /api/auth/register 201` (success)
- `POST /api/auth/register 400` (validation error)
- `POST /api/auth/register 500` (server error)

The error details will be in the console!

---

## Enable Better Error Logging

If you're not seeing enough details, check the server console when you submit.

The server should log:
- Incoming request
- Validation errors
- Database errors
- Stack traces

---

## Quick Fix: Check if Database is Writable

```powershell
cd C:\DigitalBankingSystem
node -e "const db = require('./src/services/db'); db.query('SELECT 1').then(() => console.log('DB OK')).catch(e => console.error('DB ERROR:', e))"
```

---

## What to Do Now

1. **Open the browser console** (F12) and try again
2. **Look at the actual error message**
3. **Check the Network tab** for the full response
4. **Share the error message** you see

The error will tell us exactly what's wrong!

---

*The registration route exists and should work - we just need to see the actual error!*
