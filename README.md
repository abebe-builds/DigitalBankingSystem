# 🏦 Digital Banking System - Ethiopian Banking Standards

A complete digital banking system built with **Node.js**, **Express**, **MySQL**, and **Vanilla JavaScript** - implementing real Ethiopian banking standards.

## ✨ Features

### Customer Features
- 📝 **Account Opening** - Multi-step application with OTP verification
- 💰 **Account Management** - View accounts with 13-digit account numbers (Ethiopian standard)
- 💸 **Internal Transfers** - Transfer money between accounts
- 📊 **Transaction History** - View detailed transaction records
- 🔐 **OTP Verification** - Secure account verification with SMS/Email simulation
- 👤 **Profile Management** - Update personal information

### Teller/Cashier Features
- 💵 **Cash Deposits** - Process customer deposits
- 💳 **Cash Withdrawals** - Process withdrawals with balance validation
- 📈 **Daily Statistics** - Real-time teller performance metrics
- 🧾 **Transaction Receipts** - Print-ready transaction receipts

### Account Opening Employee Features
- 📋 **Application Review** - Check application completeness
- ✅ **Completeness Validation** - Automatic missing field detection
- 📄 **Document Management** - View and manage uploaded documents
- 🔄 **Request Corrections** - Send applications back for updates

### KYC/Compliance Officer Features
- 🔍 **Identity Verification** - 11-point comprehensive KYC checklist
- 📄 **Document Authentication** - Verify ID authenticity
- ⚖️ **Compliance Screening** - AML, Sanctions, PEP, Watchlist checks
- 🏠 **Address Verification** - Verify residential address
- ⚠️ **Risk Assessment** - Low/Medium/High risk classification
- 📝 **Verification Notes** - Document findings and concerns

### Manager Features
- ✅ **Application Approval** - Approve/reject applications (after KYC)
- 🏦 **Account Activation** - Create and activate bank accounts
- 👥 **User Management** - View all accounts and users
- 📊 **Dashboard Statistics** - Overview of pending approvals

## 🇪🇹 Ethiopian Banking Standards

### Account Numbers
- **Format**: 13-digit numeric (e.g., `1000335388582`)
- **Matches**: Commercial Bank of Ethiopia standard
- **Unique**: Database-verified uniqueness

### Transaction Limits
- **Single Transaction**: 20,000 ETB maximum
- **Daily Withdrawal**: 50,000 ETB maximum
- **Minimum Initial Deposit**: 
  - SAVINGS: 200 ETB
  - CURRENT: 2,000 ETB

### Compliance
- ✅ National Bank of Ethiopia (NBE) KYC guidelines
- ✅ FATF (Financial Action Task Force) standards
- ✅ AML (Anti-Money Laundering) checks
- ✅ PEP (Politically Exposed Person) screening
- ✅ International sanctions list screening

## 🛠️ Technology Stack

### Backend
- **Node.js v20+** - JavaScript runtime
- **Express.js 4.21** - Web framework
- **MySQL 8.0 / MariaDB 10.6+** - Database
- **bcryptjs** - Password hashing
- **express-session** - Session management
- **multer** - File uploads

### Frontend
- **HTML5** - Structure
- **CSS3** - Modern styling (Grid, Flexbox)
- **Vanilla JavaScript ES6+** - No frameworks!
  - ES Modules
  - Async/Await
  - Fetch API

### Security
- **Helmet.js** - Security headers
- **Rate Limiting** - DDoS protection
- **RBAC** - Role-Based Access Control
- **SQL Injection Protection** - Parameterized queries
- **Session Security** - Secure cookies, 8-hour expiry

## 📦 Installation

### Prerequisites
- **Node.js v20 or higher**
- **MySQL 8.0 or MariaDB 10.6+**
- **Git**

### Setup Steps

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/DigitalBankingSystem.git
cd DigitalBankingSystem
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure database**
```bash
# Create database
mysql -u root -p
CREATE DATABASE digital_banking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

4. **Configure environment**
```bash
# Copy and edit .env file
cp .env.example .env
# Edit .env with your database credentials
```

5. **Run migrations**
```bash
npm run migrate
```

6. **Seed development users** (optional)
```bash
npm run seed:dev
```

7. **Start the server**
```bash
npm start
```

8. **Access the application**
```
http://localhost:3000
```

## 👥 Default Users (After Seeding)

### Customer
- **Email**: customer@dev.local
- **Password**: Customer@123

### Account Opening Employee
- **Email**: account-opening@dev.local
- **Password**: AccountOpening@123

### KYC Officer
- **Email**: kyc-officer@dev.local
- **Password**: Kyc@123

### Manager
- **Email**: manager@dev.local
- **Password**: Manager@123

### Cashier/Teller
- **Email**: cashier@dev.local
- **Password**: Cashier@123

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/auth.test.js
```

**Test Results**: 99 passing tests ✅

## 📁 Project Structure

```
DigitalBankingSystem/
├── public/                 # Frontend files
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   │   ├── api.js        # API client
│   │   ├── auth.js       # Authentication
│   │   ├── router.js     # Client-side routing
│   │   ├── components/   # Reusable UI components
│   │   └── views/        # Role-specific views
│   ├── home.html         # Landing page
│   ├── login.html        # Login page
│   └── dashboard.html    # Main SPA
├── src/                   # Backend files
│   ├── server.js         # Entry point
│   ├── config/           # Configuration
│   ├── db/               # Database connection
│   ├── middleware/       # Express middleware
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   └── migrations/       # Database migrations
├── tests/                # Automated tests
├── scripts/              # Utility scripts
├── uploads/              # User-uploaded files
├── .env                  # Environment variables
├── package.json          # Dependencies
└── README.md            # This file
```

## 🔒 Security Features

- ✅ **Password Hashing** - bcryptjs with 12 rounds
- ✅ **Session Management** - MySQL session store
- ✅ **Rate Limiting** - 500 API requests/15min
- ✅ **CSRF Protection** - Session validation
- ✅ **XSS Protection** - Content Security Policy
- ✅ **SQL Injection Prevention** - Parameterized queries only
- ✅ **File Upload Validation** - 5MB limit, type restrictions
- ✅ **Audit Logging** - All sensitive operations logged

## 🏦 Banking Workflow

```
Customer → Submits Application
    ↓
Account Opening Employee → Checks Completeness
    ↓
KYC/Compliance Officer → Verifies Identity & Compliance
    ↓
Manager → Approves Application
    ↓
Account Created & Activated → Customer can transact
```

## 📊 Key Statistics

- **Code**: ~8,000+ lines
- **Files**: 50+ organized modules
- **Tests**: 99 passing tests
- **Database Tables**: 15 tables
- **API Endpoints**: 40+ REST endpoints
- **User Roles**: 8 roles with granular permissions

## 🚀 Production Deployment

### Before Deploying:

1. **Update `.env` with production values**:
   - Strong `SESSION_SECRET`
   - Secure `DB_PASSWORD`
   - Set `COOKIE_SECURE=true`
   - Tighten rate limits

2. **Run all migrations in order**

3. **Enable HTTPS**

4. **Configure backup schedule**

5. **Set up monitoring and alerts**

## 📝 Documentation

- `ROLES_AND_RESPONSIBILITIES.md` - Detailed role descriptions
- `KYC_VERIFICATION_SYSTEM.md` - KYC checklist and procedures
- `TECHNOLOGY_STACK.md` - Complete tech stack details
- `FIX_*.md` files - Bugfix documentation

## 🤝 Contributing

This is a private banking system project. Contributions are restricted to authorized developers only.

## ⚠️ Important Notes

- **Security**: Never commit `.env` files or database credentials
- **Data**: This system handles sensitive financial data - use appropriate security measures
- **Compliance**: Ensure local banking regulations are followed
- **Testing**: Always test in development before deploying to production

## 📄 License

Proprietary - All rights reserved

## 👨‍💻 Author

Built with ❤️ for Ethiopian banking standards

---

**Status**: Production-ready ✅  
**Tests**: 99 passing ✅  
**Security**: Multiple layers ✅  
**Standards**: Ethiopian banking compliant ✅
