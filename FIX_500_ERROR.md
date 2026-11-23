# Fix 500 Internal Server Error - Public Registration

## The Problem

The server is returning **500 Internal Server Error** when you try to register.

**Root Cause:** The system uses **MySQL database**, and either:
1. MySQL is not running
2. The database `digital_banking` doesn't exist
3. MySQL password is wrong

---

## ✅ Solution: Setup MySQL Database

### Option 1: Install and Setup MySQL (If Not Installed)

#### Step 1: Check if MySQL is Installed

```powershell
mysql --version
```

**If you see:** `mysql: command not found` or similar
→ You need to install MySQL

**If you see:** `mysql Ver 8.0.xx`
→ MySQL is installed, go to Step 2

#### Step 2: Install MySQL (if needed)

1. Download MySQL: https://dev.mysql.com/downloads/installer/
2. Run installer
3. Choose "Developer Default"
4. Set root password (or leave blank for development)
5. Complete installation

#### Step 3: Start MySQL Service

```powershell
# Check if MySQL is running
Get-Service -Name "MySQL*"

# If not running, start it
Start-Service -Name "MySQL80"  # Or whatever version you have
```

#### Step 4: Create the Database

```powershell
# Connect to MySQL (enter password if you set one)
mysql -u root -p

# In MySQL prompt, run:
CREATE DATABASE digital_banking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

#### Step 5: Run Database Migrations

```powershell
cd C:\DigitalBankingSystem

# Run migrations to create tables
node src/db/migrate.js
```

#### Step 6: Restart Your Server

```powershell
# Stop the server (Ctrl+C if running)
# Then start again
npm start
```

#### Step 7: Test Registration Again

Go to http://localhost:3000/home.html and try opening an account!

---

### Option 2: Switch to SQLite (Easier for Development)

If you don't want to install MySQL, we can switch to SQLite:

**This requires code changes.** Let me know if you want me to do this.

---

## 🔍 Check What's Wrong

### Test 1: Check if MySQL is Running

```powershell
# Check MySQL service
Get-Service -Name "MySQL*"

# Should show: Status = Running
```

### Test 2: Test MySQL Connection

```powershell
# Try connecting
mysql -u root -p
# Enter password (or just press Enter if no password)

# If it connects, you're good!
# If not, MySQL isn't running or password is wrong
```

### Test 3: Check if Database Exists

```powershell
mysql -u root -p -e "SHOW DATABASES;"

# Look for "digital_banking" in the list
```

### Test 4: Check Database from Node

```powershell
cd C:\DigitalBankingSystem

node -e "import('./src/db/pool.js').then(m => m.testConnection()).then(r => console.log(r))"
```

**Expected Output (Good):**
```
{ ok: true, message: 'Database connection OK (localhost:3306/digital_banking)' }
```

**Expected Output (Bad):**
```
{ ok: false, message: 'Database connection FAILED: ...' }
```

---

## 📝 Update .env File (If Needed)

If your MySQL has a different password, update `.env`:

```env
# In C:\DigitalBankingSystem\.env

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here  # <-- Change this
DB_NAME=digital_banking
```

---

## 🎯 Quick Fix Commands

```powershell
# 1. Start MySQL
Start-Service -Name "MySQL80"

# 2. Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS digital_banking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Run migrations
cd C:\DigitalBankingSystem
node src/db/migrate.js

# 4. Test connection
node -e "import('./src/db/pool.js').then(m => m.testConnection()).then(r => console.log(r))"

# 5. Restart server
npm start
```

---

## 🚨 If You Don't Have MySQL Installed

**Two options:**

### Option A: Install MySQL (Recommended for Production-like Setup)
- Download: https://dev.mysql.com/downloads/installer/
- Follow installer
- Takes 15-20 minutes

### Option B: Switch to SQLite (Faster for Development)
- I can convert the system to use SQLite instead
- Much simpler, no installation needed
- Just uses a file on disk

**Which do you prefer?**

---

## ✅ After MySQL is Running

1. Open browser: http://localhost:3000/home.html
2. Click "Open an Account"
3. Fill in the form with these values:

```
Email: test@example.com
First Name: Kebede
Last Name: Alemu
Date of Birth: 1995-06-15
National ID: ET123456789
Phone: +251922334455
Address: Meskel Square
City: Addis Ababa
Password: MyPassword123!
Confirm: MyPassword123!
✓ Terms
✓ Privacy
```

4. Submit - should work now!

---

## 🎓 What Happened

The 500 error happens because:
1. Code tries to connect to MySQL database
2. MySQL is not running or database doesn't exist
3. Connection fails
4. Server returns 500 error

**Solution:** Get MySQL running and create the database!

---

*Let me know which option you prefer - install MySQL or switch to SQLite!*
