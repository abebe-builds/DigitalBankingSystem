# 🏦 Digital Banking System - Complete User Guide

## 🌐 Public Access (No Login Required)

### Home Page - http://localhost:3000/home.html

**✅ Open a Bank Account**
1. Click "Open an Account" button
2. **Step 1 - Personal Information:**
   - First Name, Last Name
   - Date of Birth
   - National ID
   - Phone Number
   - Email Address
   - Address (Line 1, Line 2, City)
   - Nationality
3. **Step 2 - Account Details:**
   - Choose Account Type (Savings/Checking/Fixed Deposit)
   - Initial Deposit Amount
   - Currency (ETB)
   - Sign with mouse/finger on signature pad
   - Accept Terms & Conditions
4. **Step 3 - Create Password:**
   - Create strong password (12+ chars, uppercase, lowercase, number, special char)
   - Confirm password
5. **Submit!**
   - Account created automatically
   - Logged in automatically
   - Application submitted for approval

---

## 👤 CUSTOMER Features

**Login:** Use your email and password from registration

### Dashboard - Main View

**📊 Overview Cards:**
- Total Balance (sum of all your accounts)
- Number of Accounts
- Recent Transactions count
- Pending Applications

**💳 My Accounts:**
- View all your bank accounts
- Each shows:
  - 13-digit Account Number (e.g., 1000123456789)
  - Account Type (Savings/Checking/Fixed Deposit)
  - Current Balance (ETB)
  - Status (Active/Pending)
- Click account to see details

### 🔄 Make a Transfer

**How to Transfer Money:**
1. Go to "Transfers" section
2. **Select Source Account** (your account to send from)
3. **Enter Destination Account Number** (13-digit number of recipient)
4. **Enter Amount** (in ETB)
5. **Add Description** (optional note)
6. **Generate OTP:**
   - Click "Generate OTP"
   - System shows 6-digit code on screen
   - Phone and email are masked for security
7. **Enter OTP** and click "Transfer"
8. ✅ **Money transferred instantly!**

**Transfer Limits:**
- Savings Account: Max ETB 20,000 per transaction
- Checking Account: Max ETB 50,000 per transaction
- Must have sufficient balance

### 📜 Transaction History

**View All Transactions:**
- See all deposits, withdrawals, transfers
- Each transaction shows:
  - Date & Time
  - Type (Deposit/Withdrawal/Transfer In/Transfer Out)
  - Amount
  - Balance After Transaction
  - Reference Number
  - Description
- Filter by:
  - Account
  - Date Range
  - Transaction Type
- Export to CSV

### 📝 Application Status

**Track Your Account Applications:**
- View all applications you submitted
- Status options:
  - **DRAFT** - Still filling out
  - **SUBMITTED** - Waiting for review
  - **UNDER_REVIEW** - KYC officer is reviewing
  - **KYC_VERIFIED** - Waiting for manager approval
  - **APPROVED** - Account created! ✅
  - **REJECTED** - Application denied
  - **CORRECTION_REQUIRED** - Need to fix something
- Click to view details
- Edit and resubmit if corrections needed

### 🔐 Change Password

**Update Your Password:**
1. Go to "Profile" or "Change Password"
2. Enter current password
3. Enter new password (must be strong)
4. Confirm new password
5. Submit

---

## 👨‍💼 TELLER Features

**Login Credentials:**
- Username: `teller1`
- Password: `password123`

### Dashboard Overview

**📊 Statistics:**
- Today's Deposits (count & amount)
- Today's Withdrawals (count & amount)
- Total Transactions Today
- Current Shift Summary

### 💰 Deposit Money

**How to Make a Deposit:**
1. Go to "Deposit" section
2. **Enter Account Number** (13-digit number)
   - System auto-searches as you type
   - Shows customer name when found
3. **Enter Amount** (in ETB)
4. **Select Source:**
   - Cash
   - Check
   - Transfer
5. **Add Description** (optional)
6. **Generate OTP:**
   - Click "Generate OTP"
   - Customer receives OTP on their phone/email
   - OTP shown on screen
7. **Enter OTP** from customer
8. **Submit Deposit**
9. ✅ **Money added to account instantly!**
10. **Print Receipt** (optional)

**Deposit Limits:**
- Savings: Max ETB 50,000 per day
- Checking: Max ETB 100,000 per day
- Fixed Deposit: Unlimited (but cannot withdraw)

### 💸 Withdraw Money

**How to Process Withdrawal:**
1. Go to "Withdrawal" section
2. **Enter Account Number**
   - Shows customer info and balance
3. **Enter Amount**
   - System checks if sufficient balance
   - System checks daily limit
4. **Generate OTP** for customer
5. **Customer provides OTP**
6. **Enter OTP**
7. **Submit Withdrawal**
8. ✅ **Give cash to customer**
9. **Print Receipt**

**Withdrawal Limits:**
- Savings: Max ETB 50,000 per day, ETB 20,000 per transaction
- Checking: Max ETB 100,000 per day, ETB 50,000 per transaction
- Fixed Deposit: **NO withdrawals allowed until maturity**

### 🔍 Search Accounts

**Find Customer Accounts:**
1. Go to "Search" or "Accounts"
2. **Search by:**
   - Account Number (13-digit)
   - Customer Name
   - Email
   - Phone Number
3. **View Results:**
   - Account Number
   - Customer Name
   - Account Type
   - Current Balance
   - Status
4. **Click to See Details:**
   - Full account information
   - Recent transactions
   - Customer contact info

### 📊 My Statistics

**View Your Performance:**
- Total deposits processed today
- Total withdrawals processed today
- Number of transactions
- Busiest hours
- Average transaction amount

---

## 🔍 KYC OFFICER Features

**Login Credentials:**
- Username: `kyc1`
- Password: `password123`

### Dashboard Overview

**📊 KYC Statistics:**
- Pending Verifications (need your review)
- Verified Today
- Rejected Today
- Total Applications Under Review

### 📋 Pending Applications

**View Applications Waiting for KYC:**
- List of all SUBMITTED applications
- Each shows:
  - Reference Number (e.g., APP-20240115-ABCDE)
  - Customer Name
  - Account Type
  - Submission Date
  - Status
- Click "Verify" to start review

### ✅ KYC Verification Process

**Complete 11-Point Verification Checklist:**

1. **Click on Application** to review
2. **Review Customer Information:**
   - Personal details
   - Contact information
   - Address
   - Identity documents

3. **Complete Verification Checklist:**
   - ☑ **ID Documents Verified** - Valid government ID
   - ☑ **Photo ID Matches Applicant** - Photo matches person
   - ☑ **Address Proof Verified** - Utility bill or proof of address
   - ☑ **AML Screening Passed** - Anti-Money Laundering check
   - ☑ **Sanctions Check Passed** - Not on sanctions list
   - ☑ **Watchlist Check Passed** - Not on watchlist
   - ☑ **PEP Screening Passed** - Politically Exposed Person check
   - ☑ **Source of Funds Verified** - Legitimate income source
   - ☑ **Risk Assessment Complete** - Low/Medium/High risk
   - ☑ **Beneficial Owner Identified** - True account owner confirmed
   - ☑ **Compliance Checks Passed** - Meets all regulations

4. **Add Verification Notes:**
   - Details of your findings
   - Any concerns or observations
   - Risk level assessment

5. **Decision:**
   - **Verify KYC** - All checks passed → Sends to Manager
   - **Request Corrections** - Customer needs to fix something
   - **Reject** - Application denied (with reason)

6. **Submit Decision**
   - Application status updated
   - Customer notified
   - Manager can approve (if verified)

### 📄 View Documents

**Review Uploaded Documents:**
- National ID (front/back)
- Passport
- Driver's License
- Proof of Address
- Selfie Photo
- Other supporting documents
- Mark documents as verified
- Request additional documents if needed

### 📊 My KYC Statistics

**Your Performance Metrics:**
- Applications verified this week/month
- Average verification time
- Approval rate
- Rejection reasons breakdown

---

## 👔 MANAGER Features

**Login Credentials:**
- Username: `manager1`
- Password: `password123`

### Dashboard Overview

**📊 Management Statistics:**
- Pending Approvals (waiting for you)
- Approved Today
- Rejected Today
- Total Active Accounts
- System-wide Metrics

### ✅ Approve Applications

**Review KYC-Verified Applications:**

1. **Go to "Pending Approvals"**
2. **View Applications:**
   - Only shows KYC_VERIFIED applications
   - Each shows:
     - Reference Number
     - Customer Name
     - Account Type
     - Initial Deposit
     - KYC Officer who verified
     - Verification Date
     - KYC Notes

3. **Review Application Details:**
   - Personal Information
   - Account Type & Initial Deposit
   - KYC Verification Checklist Results
   - KYC Officer Notes
   - Risk Assessment
   - All Documents

4. **Make Decision:**
   - **Approve** ✅
     - Account is created immediately
     - 13-digit account number generated
     - Initial deposit credited
     - Customer can start using account
     - Customer notified by email
   - **Reject** ❌
     - Application denied
     - Must provide rejection reason
     - Customer notified
     - Can reapply later

5. **Add Manager Notes** (optional)
6. **Submit Decision**

**⚠️ Important Rules:**
- You **CANNOT** approve your own applications
- System blocks self-approval
- Must be verified by KYC officer first

### 📊 System Reports

**View Banking Statistics:**
- **Account Statistics:**
  - Total active accounts
  - Accounts by type (Savings/Checking/Fixed)
  - New accounts this month
  - Account distribution by region/city

- **Transaction Statistics:**
  - Total transactions today/week/month
  - Transaction volume (ETB)
  - Deposits vs Withdrawals
  - Transfer activity
  - Peak transaction times

- **Application Pipeline:**
  - Applications by status
  - Average approval time
  - Rejection rate
  - Bottlenecks in workflow

- **Customer Statistics:**
  - Total customers
  - Active vs Inactive
  - Customer growth trend
  - Demographics

- **Teller Performance:**
  - Transactions per teller
  - Busiest tellers
  - Error rates
  - Service times

- **KYC Performance:**
  - Verification times
  - Approval rates
  - Risk assessment distribution

### 👥 User Management

**Manage System Users:**
- View all users (tellers, KYC officers, customers)
- Create new user accounts
- Assign roles and permissions
- Suspend/activate accounts
- Reset passwords
- View user activity logs

### ⚙️ System Settings

**Configure System:**
- Transaction limits
- OTP settings
- Session timeout
- Security policies
- Business hours
- Holiday calendar

---

## 🔐 Security Features (All Roles)

### 🛡️ Account Security

**Password Protection:**
- Minimum 12 characters
- Must have uppercase, lowercase, number, special character
- Passwords hashed with bcrypt (never stored in plain text)
- Cannot reuse recent passwords

**Account Lockout:**
- After 5 failed login attempts
- Account locked for 15 minutes
- Automatic unlock after timeout

**Session Security:**
- Auto-logout after 8 hours of inactivity
- Secure session cookies (HttpOnly, SameSite)
- Session regeneration on login

### 📱 OTP Verification

**One-Time Passwords:**
- 6-digit codes
- Generated for sensitive operations:
  - Money transfers
  - Deposits
  - Withdrawals
- Expires in 10 minutes
- Single-use only
- After 3 failed attempts, OTP is locked
- Phone and email masked for privacy

### 🔒 Role-Based Access Control

**28 Granular Permissions:**
- Each role has specific permissions
- Cannot access features outside your role
- All actions are audited
- Prevents unauthorized access

---

## 📱 Account Types & Limits

### 💰 Savings Account

**Features:**
- For everyday savings
- Good for personal use
- Flexible access

**Limits:**
- Daily Withdrawal: ETB 50,000
- Single Transaction: ETB 20,000
- Daily Transfer: ETB 50,000
- No minimum balance
- Withdrawals: Unlimited
- Transfers: Allowed

### 💼 Checking Account

**Features:**
- For businesses and high-volume users
- Higher transaction limits
- More flexibility

**Limits:**
- Daily Withdrawal: ETB 100,000
- Single Transaction: ETB 50,000
- Daily Transfer: ETB 80,000
- No minimum balance
- Withdrawals: Unlimited
- Transfers: Allowed

### 📈 Fixed Deposit

**Features:**
- Lock money for fixed term
- Higher interest rates
- Cannot withdraw until maturity

**Limits:**
- Deposits: Unlimited (via teller only)
- Withdrawals: **BLOCKED** until maturity
- Transfers: **BLOCKED** until maturity
- Early withdrawal: Not permitted
- Best for long-term savings

---

## 🔔 Notifications

**You Get Notified When:**
- ✅ Account application approved
- ❌ Application rejected
- 💰 Money deposited to your account
- 💸 Money withdrawn from your account
- 🔄 Transfer completed
- 🔐 Password changed
- 🚫 Failed login attempts
- 📱 OTP sent

---

## 🆘 Help & Support

### Common Questions

**Q: I forgot my password. What do I do?**
A: Contact your bank branch or system administrator. Only they can reset passwords securely.

**Q: Why can't I transfer more than ETB 20,000?**
A: That's your account's daily single transaction limit. You have a Savings account. Upgrade to Checking for higher limits (ETB 50,000).

**Q: My OTP expired. Can I get a new one?**
A: Yes! Click "Generate OTP" again. OTPs expire in 10 minutes.

**Q: How long does application approval take?**
A: Usually 1-3 business days. KYC officer verifies first, then manager approves.

**Q: Can I have multiple accounts?**
A: Yes! You can have Savings, Checking, and Fixed Deposit accounts.

**Q: Where is my account number?**
A: It's the 13-digit number starting with "1000" shown on your dashboard. Example: 1000123456789

**Q: Why was my application rejected?**
A: Check the rejection reason in your application details. You can reapply after fixing the issues.

---

## 📞 Test Users (For Demo)

### Customers:
- **Username:** `abebe` | **Password:** `password123`
- **Username:** `biruk` | **Password:** `password123`

### Teller:
- **Username:** `teller1` | **Password:** `password123`

### KYC Officer:
- **Username:** `kyc1` | **Password:** `password123`

### Manager:
- **Username:** `manager1` | **Password:** `password123`

---

## 🎯 Quick Start Workflow

### Test the Complete System:

**1. Public Registration (No Login):**
   - Go to http://localhost:3000/home.html
   - Click "Open an Account"
   - Fill all 3 steps
   - Submit → You're logged in!

**2. As Customer:**
   - See your pending application
   - Wait for approval OR...

**3. As KYC Officer (kyc1):**
   - Review the application
   - Complete 11-point checklist
   - Verify KYC → Send to manager

**4. As Manager (manager1):**
   - Review verified application
   - Approve → Account created!

**5. As Customer (back to your account):**
   - See new account with 13-digit number
   - Initial deposit is there
   - Make a transfer to another customer

**6. As Teller (teller1):**
   - Search for account by number
   - Make a deposit
   - Make a withdrawal
   - Use OTP for verification

---

## ✅ All Features Working

- ✅ Public account registration
- ✅ Customer login & dashboard
- ✅ Money transfers with OTP
- ✅ Transaction history
- ✅ Teller deposits & withdrawals
- ✅ Account search by number
- ✅ KYC 11-point verification
- ✅ Manager approval workflow
- ✅ 13-digit Ethiopian account numbers
- ✅ Double-entry bookkeeping ledger
- ✅ Role-based permissions (28 permissions)
- ✅ Security (bcrypt, OTP, session management)
- ✅ Account lockout after failed logins
- ✅ Password strength requirements
- ✅ Transaction limits by account type
- ✅ Application status tracking
- ✅ Document upload & verification
- ✅ System statistics & reports
- ✅ Responsive design (works on mobile)


