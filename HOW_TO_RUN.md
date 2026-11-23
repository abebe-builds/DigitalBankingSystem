# How to Run Your Digital Banking System

## 🚀 Quick Start

### Start the Server

**Option 1: Using npm**
```bash
cd C:\DigitalBankingSystem
npm start
```

**Option 2: Using node directly**
```bash
cd C:\DigitalBankingSystem
node app.js
```

The server will start on: **http://localhost:3000**

---

## 🌐 Open in Browser

Once the server is running, open your browser and go to:

```
http://localhost:3000
```

Or simply open: **http://localhost:3000/login.html**

---

## 👤 Test Users

### Customer Account
- **Username:** `abebe`
- **Password:** `password123`
- **Account Number:** 1000000000001 (or check in database)

### Teller Account
- **Username:** `teller1`
- **Password:** `password123`

### Manager Account
- **Username:** `manager1`
- **Password:** `password123`

### KYC Officer Account
- **Username:** `kyc1`
- **Password:** `password123`

---

## 🧪 Run Tests

```bash
npm test
```

You should see: **99 tests passing**

---

## 🛑 Stop the Server

Press: **Ctrl + C** in the terminal where the server is running

Or kill the process:
```bash
# Find the process
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Kill it (replace XXXX with the process ID)
Stop-Process -Id XXXX
```

---

## 🔧 Troubleshooting

### Port Already in Use

If you see: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:** Kill the existing Node process
```bash
# Find Node processes
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# Kill all Node processes
Get-Process -Name "node" | Stop-Process -Force
```

Then start again:
```bash
npm start
```

### Database Not Found

If you see database errors:

**Solution:** The database will be created automatically on first run.
If issues persist, check that `src/db/` directory exists.

### Dependencies Missing

If you see `Error: Cannot find module...`

**Solution:** Install dependencies
```bash
npm install
```

---

## 📱 What You Can Test

### As Customer (login as `abebe`)
1. ✅ View account balance
2. ✅ Make transfers to other accounts
3. ✅ View transaction history
4. ✅ Change password

### As Teller (login as `teller1`)
1. ✅ Deposit money (search by account number)
2. ✅ Withdraw money
3. ✅ View teller statistics
4. ✅ Search accounts

### As KYC Officer (login as `kyc1`)
1. ✅ Review account applications
2. ✅ Verify with 11-point checklist
3. ✅ Add verification notes
4. ✅ Approve or reject

### As Manager (login as `manager1`)
1. ✅ Approve verified applications
2. ✅ View system statistics
3. ✅ Monitor application pipeline

---

## 📊 Check Server Status

```bash
# Check if server is running
curl http://localhost:3000 -UseBasicParsing

# Should return: StatusCode 200 OK
```

---

## 🎯 Development Workflow

### 1. Start Development
```bash
cd C:\DigitalBankingSystem
npm start
```

### 2. Make Changes
Edit files in `src/` or `public/`

### 3. Restart Server
Press `Ctrl + C`, then `npm start` again

### 4. Test Changes
```bash
npm test
```

### 5. Commit Changes
```bash
git add .
git commit -m "feat: description of changes"
git push origin main
```

---

## 🔗 Important URLs

- **Home/Login:** http://localhost:3000/login.html
- **Dashboard:** http://localhost:3000/dashboard.html
- **Health Check:** http://localhost:3000/api/health

---

## 📝 Server Output

When running, you'll see:
```
Server running on http://localhost:3000
Database connected successfully
```

---

## ⚡ Quick Commands

```bash
# Start
npm start

# Test
npm test

# Install dependencies
npm install

# Check status
curl http://localhost:3000 -UseBasicParsing

# Stop (Ctrl + C or)
Get-Process -Name "node" | Stop-Process -Force
```

---

## 🎉 Enjoy Testing Your Banking System!

Your complete Digital Banking System with:
- ✅ 99 passing tests
- ✅ Ethiopian 13-digit account numbers
- ✅ KYC verification
- ✅ Multi-role dashboards
- ✅ Transaction system

**Server URL:** http://localhost:3000

---

*Keep this file for reference!*
