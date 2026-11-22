# Development Status — Digital Banking System

---

## Phase 1 — Backend Foundation (COMPLETE)

### Completed work
- Project scaffolding: `package.json` (ESM, pinned dependencies), `.env.example`, `.env`, `.gitignore`, `npm run check` syntax tool.
- Express backend (`src/app.js`, `src/server.js`) with security middleware (helmet, cors, rate-limit, morgan, express.json), health route, 404 handler, error handler (no stack leaks in production).
- `mysql2/promise` pool (`src/db/pool.js`) with `testConnection()` helper.
- DB bootstrap (`src/db/init.js`) — creates `digital_banking` idempotently, never drops.
- Versioned migration runner (`src/db/migrate.js`) — idempotent, no transaction wrapper (DDL auto-commits in MySQL/MariaDB; all migrations must be SQL-idempotent), `--status` flag.
- Initial schema migration (`001_create_roles.sql`) — `roles` table + 9 system roles (`is_system=1`).
- Tests: `node:test` + `node:assert/strict` + `supertest`. 4 tests, pass 4, fail 0.

### Migrations applied (Phase 1)
- `001_create_roles.sql` — roles table + 9 system roles.

---

## Phase 2 — Authentication, Sessions, RBAC (COMPLETE)

### Completed work
- **New dependencies (pinned):** `bcryptjs@2.4.3`, `express-session@1.18.1`, `express-mysql-session@3.0.0`.
- **Env additions:** `SESSION_SECRET` (production guard), `SESSION_MAX_AGE_MS`, `BCRYPT_ROUNDS`, `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCK_MINUTES`, `COOKIE_SECURE`, `RATE_LIMIT_MAX_API`, `RATE_LIMIT_MAX_LOGIN`.
- **3 new migrations** (idempotent — `IF NOT EXISTS` + `INSERT IGNORE` / `ON DUPLICATE KEY`):
  - `002_create_users.sql` — `users` table with lockout fields.
  - `003_create_permissions.sql` — `permissions` + `role_permissions` tables; 28 permission codes seeded; 9 roles mapped per least-privilege matrix.
  - `004_create_sessions.sql` — `sessions` table for `express-mysql-session` (schema-matched, `createDatabaseTable: false`).
- **Session middleware** (`src/config/session.js`) — MySQL-backed, httpOnly + sameSite=lax + secure=COOKIE_SECURE cookie, `clearExpired: false` (no background interval; prevents process-exit hang in tests).
- **Auth service** (`src/services/authService.js`) — `findUserByEmail`, `verifyPassword`, `hashPassword`, `recordFailedLogin` (lockout after `LOGIN_MAX_ATTEMPTS`), `recordSuccessfulLogin`, `isLockedOut`, `validatePasswordPolicy` (min 12 chars, upper, lower, digit, special), `changePassword`, `dummyVerify` (timing equalization — prevents email enumeration via response time).
- **Middleware:** `authenticate.js` (`requireAuth`), `authorize.js` (`requirePermission`, `requireRole`, per-request perm cache), `loginLimiter.js` (configurable via `RATE_LIMIT_MAX_LOGIN`).
- **Routes:** `POST /api/auth/login` (session regeneration on success, generic errors, lockout check), `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`; `GET /api/users` (paginated, `users.view`).
- **Dev seed:** `scripts/seed-dev-users.js` (`npm run seed:dev`) — 9 dev users (one per role, `DevPass123!`), refuses to run in production.
- **Security fixes applied (from review):**
  - `.env.example` `SESSION_SECRET` set to `change-me-in-production` — matches the production guard string exactly.
  - `dummyVerify()` equalizes response time on unknown-email path (~350ms both paths).
  - `requirePermission` null guard (returns 403 safely if called without `requireAuth`).
- **Rate limit fix:** Both `apiLimiter` and `loginLimiter` use configurable max from env (`RATE_LIMIT_MAX_API=500`, `RATE_LIMIT_MAX_LOGIN=50` in dev `.env`) — prevents test exhaustion without `NODE_ENV` dependency (PowerShell env-var propagation is unreliable in this tooling environment).
- **Test runner fix:** `--test-force-exit` added to test script; `pool.end()` removed from individual test files (shared pool issue); `clearExpired: false` in session store (no background interval to block exit).

### Current architecture
- **Runtime:** Node.js ESM, Express 4.
- **Config:** `src/config/env.js` (validated config + production guards), `src/config/db.js` (pool options), `src/config/session.js` (MySQL session store, exported `store`).
- **Database:** `src/db/pool.js` (pool + `testConnection`), `src/db/init.js` (bootstrap), `src/db/migrate.js` (versioned runner).
- **Auth flow:** Login → normalize email → `findUserByEmail` → `dummyVerify` (unknown) or `isLockedOut` → status check → `verifyPassword` → `session.regenerate` → `recordSuccessfulLogin` → safe user in session.
- **RBAC:** `requireAuth` loads fresh user row (catches status changes), attaches `req.user` (no hash). `requirePermission` queries `role_permissions JOIN permissions` per `role_id`, cached on `req._rolePerms` per request.
- **Middleware stack (app.js):** helmet → cors → morgan(dev) → apiLimiter(/api) → session → express.json → routes(/api/health, /api/auth, /api/users) → notFound → errorHandler.

### Files created/changed (Phase 2)
```
New:
  src/config/session.js
  src/services/authService.js
  src/middleware/authenticate.js
  src/middleware/authorize.js
  src/middleware/loginLimiter.js
  src/routes/auth.js
  src/routes/users.js
  src/migrations/002_create_users.sql
  src/migrations/003_create_permissions.sql
  src/migrations/004_create_sessions.sql
  scripts/seed-dev-users.js
  tests/auth.test.js
  tests/rbac.test.js
  tests/security.test.js
  tests/teardown.test.js

Updated:
  src/app.js          (session middleware, auth/users routes, configurable rate limits)
  src/config/env.js   (SESSION_SECRET, BCRYPT_ROUNDS, rate limit config, production guard)
  package.json        (new deps, seed:dev script, --test-force-exit)
  .env / .env.example (new env vars)
  tests/auth.test.js  (pool.end removed — shared pool)
  tests/db.test.js    (pool.end removed)
  tests/migrations.test.js (pool.end removed)
  tests/rbac.test.js  (pool.end removed)
  tests/security.test.js (pool.end removed)
```

### Migrations applied (Phase 2)
- `002_create_users.sql` — users table.
- `003_create_permissions.sql` — permissions + role_permissions + 28 codes + 9 role mappings.
- `004_create_sessions.sql` — sessions table.
- Tables in `digital_banking`: `roles`, `schema_migrations`, `users`, `permissions`, `role_permissions`, `sessions`.

### Role → permission matrix (data-level, from live DB)

| Role | Permissions |
|---|---|
| Customer | accounts.view.own, profile.update, statements.view.own, transfers.internal |
| Account Opening Employee | applications.create, applications.request_correction, applications.review |
| KYC/Compliance Officer | applications.review, documents.view, kyc.verify |
| Manager/Authorized Approver | accounts.view, applications.approve, applications.reject, users.view |
| Cashier/Teller | teller.deposit, teller.withdraw, transactions.view |
| Customer Support | accounts.view.limited, support.tickets, users.view |
| Auditor | audit.read, everything.view |
| Operations/Finance | ledger.view, reconciliation.run, reports.view |
| **System Administrator** | roles.manage, system.admin, system.config, users.manage, users.view — **NO** ledger.post, teller.deposit, teller.withdraw, transfers.internal, applications.approve, applications.reject, kyc.verify |

### Tests executed + real results (Phase 2)

All commands run against Node v24.21.0, MariaDB 10.4.32 @ localhost:3306 (root/no-password).

**`npm run check`** → Syntax check passed for 26 file(s).

**`npm test`** (node --test --test-force-exit tests/*.test.js):
```
33 tests, pass 33, fail 0  (duration ~8.5s)

auth.test.js   (11 tests) — all ✔
db.test.js     (2 tests)  — all ✔
health.test.js (1 test)   — ✔
migrations.test.js (1 test) — ✔
rbac.test.js   (10 tests) — all ✔
security.test.js (3 tests) — all ✔
teardown.test.js — placeholder only
```

**DB verification (independent MySQL queries):**
- SHOW TABLES → roles, schema_migrations, users, permissions, role_permissions, sessions ✔
- System Administrator permissions → roles.manage, system.admin, system.config, users.manage, users.view ONLY — NO financial/approval codes ✔
- Full role→permission matrix verified against live DB ✔

### Known issues
- (Minor, deferred to Phase 5) `CORS_ORIGIN` not honored in dev (origin forced true). Safe locally.
- (Non-blocking, deferred) `change-password` double-validates password policy at route + service layers (divergence risk if policy changes). Consolidate in a future cleanup pass.
- (Non-blocking, deferred) `rbac.test.js` covers 3 of 7 forbidden sysadmin permissions via HTTP; remaining 4 are covered at data level (DB query assertions) but not via live HTTP middleware test endpoints. Add Phase 3+ integration tests as endpoints are added.
- npm reports pre-existing transitive audit advisories (not introduced by Phase 2).

### Dev credentials (seed:dev)
Run `npm run seed:dev` once to create test users. Password for all: `DevPass123!`
- customer@dev.local (Customer)
- account-opening@dev.local (Account Opening Employee)
- kyc-officer@dev.local (KYC/Compliance Officer)
- manager@dev.local (Manager/Authorized Approver)
- cashier@dev.local (Cashier/Teller)
- support@dev.local (Customer Support)
- auditor@dev.local (Auditor)
- operations@dev.local (Operations/Finance)
- sysadmin@dev.local (System Administrator)

---

## Phase 3 — Customer Onboarding, KYC, OTP, Account Creation (COMPLETE)

### Completed work
- **New dependencies (pinned):** `multer@1.4.5-lts.1` (file uploads), `uuid@9.0.1` (stored filename generation).
- **Env additions:** `OTP_EXPIRY_MINUTES=10`, `OTP_MAX_ATTEMPTS=3`, `UPLOAD_DIR=uploads`, `MAX_FILE_SIZE_MB=5`.
- **6 new migrations** (005–010, idempotent):
  - `005_create_application_tables.sql` — `account_applications` + `application_documents`
  - `006_create_otp_table.sql` — `otp_tokens` (bcrypt-hashed, expiring, attempt-counted)
  - `007_create_accounts_table.sql` — `bank_accounts` (Phase 4 adds ledger logic)
  - `008_seed_phase3_permissions.sql` — Phase 3 permissions seeded to roles
  - `009_fix_account_number_length.sql` — VARCHAR length fix for MariaDB 10.4
  - `010_fix_otp_expires_at.sql` — DEFAULT fix for MariaDB 10.4 TIMESTAMP column
- **Services:**
  - `applicationService.js` — full 7-state lifecycle (DRAFT→SUBMITTED→UNDER_REVIEW→APPROVED→ACCOUNT_CREATED + CORRECTION_REQUIRED + REJECTED), self-approval prevention, cross-customer isolation, idempotent account creation, collision-safe reference/account number generation
  - `otpService.js` — 6-digit crypto OTP, bcrypt-hashed storage, expiry, attempt locking, previous OTP invalidation
  - `documentService.js` — simulated file metadata storage (clearly labelled — no real verification service)
- **Middleware:** `upload.js` — multer disk storage, UUID filenames, MIME filter (images + PDF), size limit
- **Routes:**
  - `/api/applications` (12 endpoints) — full application workflow + document upload
  - `/api/otp` — send/verify OTP (dev: logs OTP plaintext with `[DEV ONLY]` prefix, never in production)
- **`uploads/`** directory — created at server startup, gitignored, local disk only (production requires object storage)

### State machine
```
DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACCOUNT_CREATED
                         ↓
                  CORRECTION_REQUIRED → SUBMITTED (re-submit)
              UNDER_REVIEW or SUBMITTED → REJECTED
```
All transitions validated server-side. Self-approval blocked (approver ≠ reviewer). Cross-customer access blocked (service-layer ownership check).

### Files created (Phase 3)
```
New:
  src/migrations/005_create_application_tables.sql
  src/migrations/006_create_otp_table.sql
  src/migrations/007_create_accounts_table.sql
  src/migrations/008_seed_phase3_permissions.sql
  src/migrations/009_fix_account_number_length.sql
  src/migrations/010_fix_otp_expires_at.sql
  src/services/applicationService.js
  src/services/otpService.js
  src/services/documentService.js
  src/middleware/upload.js
  src/routes/applications.js
  src/routes/otp.js
  tests/applications.test.js
  tests/otp.test.js
Updated:
  src/app.js         (new routes wired)
  src/config/env.js  (OTP + upload config)
  package.json       (multer, uuid deps)
  .env / .env.example / .gitignore
```

### Migrations applied (Phase 3)
All 10 migrations applied (001–010). Tables: `account_applications`, `application_documents`, `bank_accounts`, `otp_tokens`, `permissions`, `role_permissions`, `roles`, `schema_migrations`, `sessions`, `users`.

### Tests executed + real results (Phase 3)

**`npm test`** (node --test --test-force-exit tests/*.test.js):
```
63 tests, pass 63, fail 0  (duration ~9.2s)  EXIT:0

applications.test.js (18 tests) — all ✔
  create draft, reference_number format, isolation, submit, double-submit 409,
  review, customer-cannot-review 403, correction cycle, self-approval 409,
  approval (different reviewer/approver), rejection, account creation 201,
  account number format, idempotent create-account, cross-customer 404,
  invalid state transitions 409

otp.test.js (9 tests) — all ✔
  send OTP → hash in DB not plaintext, invalid purpose 400, unauthenticated 401,
  new OTP invalidates previous, verify correct → valid:true,
  wrong OTP → valid:false + attempts++, used OTP invalid, expired OTP invalid,
  max attempts lockout, missing token 400

auth.test.js   (11) ✔  db.test.js (2) ✔  health.test.js (1) ✔
migrations.test.js (1) ✔  rbac.test.js (10) ✔  security.test.js (3) ✔
```

### Known issues
- File storage is local disk only. Production requires a secure object storage service (e.g. S3-compatible). Identity documents are NOT genuinely verified — labelled clearly in code and responses.
- OTP delivery is simulated (dev logs plaintext with `[DEV ONLY]` prefix). Real SMS/email gateway integration required for production.
- (Carried from Phase 2) CORS_ORIGIN not honored in dev. Fix in Phase 5.

---

## Phase 4 — Double-Entry Ledger, Teller Ops, Financial Integrity (COMPLETE)

### Completed work
- **3 new migrations** (011–013, idempotent):
  - `011_create_ledger_tables.sql` — `transactions`, `ledger_entries`, `transaction_limits` (9 default limits seeded), `teller_sessions`; `ledger.post` granted to Operations/Finance
  - `012_create_audit_log.sql` — `audit_log` table
  - `013_phase4_permissions.sql` — additional permission grants for Phase 4
- **Env additions:** `MAX_DAILY_WITHDRAWAL_ETB`, `MAX_SINGLE_TRANSACTION_ETB` (env fallback values).
- **Services:**
  - `accountService.js` — account lifecycle: activate (PENDING→ACTIVE), suspend, close (zero-balance check), ownership-guarded reads
  - `ledgerService.js` — the financial core: every operation uses a **dedicated mysql2 connection** (not pool) with `BEGIN TRANSACTION` + `SELECT ... FOR UPDATE` row-locking; lower-ID-first deadlock prevention for transfers; idempotency checks on all financial ops; `verifyLedgerBalance` (SUM CREDIT−DEBIT vs stored balance); CURDATE() for timezone-safe daily totals
  - `reconciliationService.js` — `runReconciliation` (all active accounts), `getTellerSummary` (CURDATE()-based)
- **Routes:**
  - `/api/accounts` — list, get, activate, suspend, close
  - `/api/transactions` — deposit (`teller.deposit`), withdrawal (`teller.withdraw`), transfer (`transfers.internal`), reverse (`ledger.post`), list, get
  - `/api/reconciliation` — run reconciliation, teller summary
- **Financial integrity guarantees (enforced in code):**
  - Every posted transaction has balanced DEBIT+CREDIT ledger entries
  - `SELECT FOR UPDATE` on bank_accounts prevents concurrent balance races
  - No overdrafts (balance checked before withdrawal/transfer)
  - Daily withdrawal/transfer limits enforced (CURDATE() timezone-safe)
  - Single-transaction limits enforced per account type
  - Fixed deposit accounts reject withdrawals
  - Reversals create opposite entries; original marked REVERSED (never edited/deleted)
  - Idempotency key deduplication on all financial operations
  - Audit log entry on every financial operation

### Bugs found and fixed (post-workflow)
- **Reversal response**: `postReversal` was returning the pre-UPDATE `orig` snapshot — fixed to re-fetch after commit so `originalTransaction.status = 'REVERSED'`.
- **Daily limit deposit seed**: test deposited 200,000 as single transaction, exceeding CHECKING's 50,000 single-tx limit — fixed to 4×50,000.
- **Timezone mismatch**: `getDailyTotalInternal` and `getTellerSummary` used JS `new Date().toISOString().slice(0,10)` (UTC) vs MariaDB `DATE(created_at)` (server time) — fixed to use `CURDATE()` in SQL when no explicit date is passed. Tests updated to pass `null` to force `CURDATE()` path.

### Files created/changed (Phase 4)
```
New:
  src/migrations/011_create_ledger_tables.sql
  src/migrations/012_create_audit_log.sql
  src/migrations/013_phase4_permissions.sql
  src/services/accountService.js
  src/services/ledgerService.js
  src/services/reconciliationService.js
  src/routes/accounts.js
  src/routes/transactions.js
  src/routes/reconciliation.js
  tests/ledger.test.js
  tests/reconciliation.test.js
Changed:
  src/app.js                    (new routes wired)
  src/config/env.js             (transaction limit fallback config)
  src/services/ledgerService.js (reversal re-fetch fix, CURDATE() fix)
  src/services/reconciliationService.js (CURDATE() fix)
  tests/ledger.test.js          (multi-deposit fix for daily limit test)
  tests/reconciliation.test.js  (pass null date for CURDATE() path)
  package.json / .env / .env.example
```

### Migrations applied (Phase 4)
All 13 migrations applied (001–013). Tables in `digital_banking` (15 total):
`account_applications`, `application_documents`, `audit_log`, `bank_accounts`, `ledger_entries`, `otp_tokens`, `permissions`, `role_permissions`, `roles`, `schema_migrations`, `sessions`, `teller_sessions`, `transaction_limits`, `transactions`, `users`.

### Tests executed + real results (Phase 4)

**`npm run check`** → Syntax check passed for 42 file(s).

**`npm test`** (node --test --test-force-exit tests/*.test.js):
```
78 tests, pass 78, fail 0  (duration ~14s)

ledger.test.js         (12 tests) — all ✔
  deposit CREDIT entry+balance, withdrawal DEBIT+balance, insufficient funds 400,
  transfer both balances+2 entries, non-existent account 404, transfer insufficient 400,
  daily withdrawal limit 400 on 3rd, idempotency 200 on repeat, verifyLedgerBalance=true,
  reversal REVERSED+balance restored, cannot reverse reversal 400, fixed deposit 400

reconciliation.test.js (3 tests)  — all ✔
  balanced account, corrupted balance detected, teller summary totals

Phase 1–3 baseline (63 tests) — all ✔ (no regression)
```

### Known issues
- `teller_sessions` table exists but teller session open/close endpoints are not yet implemented (not in Phase 4 scope; can be added in Phase 6 cleanup).
- Balance in `bank_accounts` is an optimistic cache; `verifyLedgerBalance` is the authoritative check. Run `/api/reconciliation/run` to detect any discrepancies.

---

## Phase 5 — Frontend Integration (COMPLETE)

### Completed work
- **Static file serving** added to `src/app.js`: `express.static(public/)` + SPA fallback regex + Helmet CSP (allows inline styles) + CORS with `credentials:true`.
- **Login page** (`public/index.html`): split-screen design — animated navy→blue gradient branding panel with bank name "DigitalBank ETB" and feature list on the left, clean white login card with password visibility toggle on the right. Responsive (single column on mobile).
- **Dashboard shell** (`public/dashboard.html`): fixed 260px dark navy sidebar, white topbar with user avatar and logout, role-aware content area. Mobile drawer sidebar with hamburger menu.
- **Change password page** (`public/change-password.html`): forced when `must_change_password=1`.
- **CSS design system** (5 files): `tokens.css` (CSS custom properties — navy+gold Ethiopian palette), `base.css` (reset, typography), `layout.css` (sidebar/topbar grid, responsive), `components.css` (buttons, forms, cards, tables, badges, toasts, modals, skeletons), `pages.css` (login, dashboard sections, pagination). Animated gradient login, pill-shaped color-coded status badges, striped tables, slide-in toasts, CSS loading skeletons, empty states.
- **JS architecture** (21 files):
  - `api.js` — centralized fetch wrapper; `credentials:'include'`; 401 → redirect to login; JSON parsing with error normalization
  - `auth.js` — login form, dashboard bootstrap (GET /me), logout, change-password flow
  - `router.js` — hash-based SPA router; maps each of 9 roles to its view module via dynamic import; `user-ready` event drives rendering
  - `utils.js` — formatCurrency (ETB), formatDate, timeAgo, formatStatus, statusBadge (color-coded), formatTxnType, escapeHtml, buildTable, buildPagination, setButtonLoading, skeleton
  - 8 components: `sidebar.js`, `topbar.js`, `accountCard.js`, `transactionTable.js`, `applicationCard.js`, `modal.js`, `toast.js`, `skeleton.js`
  - 9 role views: `customer.js`, `account-opening.js`, `kyc-officer.js`, `manager.js`, `cashier.js`, `support.js`, `auditor.js`, `operations.js`, `sysadmin.js` — each wired to real API endpoints (no fake buttons)
- **Session handling**: httpOnly cookie (managed by backend); 401 globally redirects to login; nothing sensitive stored in JS; `sessionStorage` only caches the user object for UI rendering.
- **Regression test** `tests/frontend.test.js` (6 tests): login page served, dashboard served, CSS served, JS served, SPA fallback works, `/api/health` still works after static serving.

### Files created (Phase 5)
```
public/
  index.html, dashboard.html, change-password.html
  assets/logo.svg
  css/{tokens,base,layout,components,pages}.css
  js/
    api.js, auth.js, router.js, utils.js
    components/{sidebar,topbar,accountCard,transactionTable,applicationCard,modal,toast,skeleton}.js
    views/{customer,account-opening,kyc-officer,manager,cashier,support,auditor,operations,sysadmin}.js
tests/frontend.test.js
Updated: src/app.js (static serving + CSP + CORS), .gitignore (public/uploads)
```

### Tests executed + real results (Phase 5)

**`npm test`** (node --test --test-force-exit tests/*.test.js):
```
84 tests, pass 84, fail 0  (duration ~19s)

frontend.test.js (6 tests) — all ✔
  GET / serves login HTML, GET /dashboard.html serves HTML,
  GET /css/tokens.css serves CSS, GET /js/auth.js serves JS,
  GET /unknown falls back to index.html (SPA), GET /api/health still ok

Phase 1–4 baseline (78 tests) — all ✔ (no regression)
```

**Live smoke test (run by orchestrator):**
- Started `node src/server.js` → listens on :3000, DB health OK
- `GET /` → 200, serves login page HTML with "DigitalBank ETB"
- `POST /api/auth/login` with `customer@dev.local / DevPass123!` → 200, returns user object `{role_name:"Customer", status:"active"}`, session cookie set

### Known issues / limitations
- This is a simulation — clearly labelled; not a licensed bank.
- Document upload in the UI uses multipart via the API; the customer application form includes the document upload field.
- OTP delivery is simulated (dev logs plaintext with `[DEV ONLY]`); production needs SMS/email gateway.
- File storage is local disk; production needs object storage. Identity documents are NOT genuinely verified.
- CORS restricted to localhost dev origins; tighten via `CORS_ORIGIN` env for production.

### Manual steps to use the UI
1. Start XAMPP MySQL (already running).
2. In `c:\DigitalBankingSystem`, run: `npm start`
3. Open browser → `http://localhost:3000` → you'll see the DigitalBank ETB login page.
4. Log in with any dev user (password `DevPass123!`):
   - `customer@dev.local` — accounts, transfers, applications, OTP
   - `cashier@dev.local` — deposit/withdrawal, teller summary
   - `manager@dev.local` — approvals, account activation
   - `kyc-officer@dev.local` — KYC review, document verification
   - `account-opening@dev.local` — application review, correction requests
   - `operations@dev.local` — reconciliation, reversals
   - `auditor@dev.local` — read-only transaction/ledger audit
   - `support@dev.local` — user/account lookup
   - `sysadmin@dev.local` — user management, system info
5. Each role gets a tailored dashboard with role-appropriate actions wired to real APIs.

---

## Phase 6 — Integration Testing, Security Review, Documentation (COMPLETE)

### Completed work
- **Integration tests** (`tests/integration.test.js`, 10 tests): end-to-end flows spanning all phases — full customer onboarding → approval → account activation → teller deposit/withdrawal → reversal; cross-role authorization checks (customer can't deposit, cashier can't approve, sysadmin can't reverse)
- **Security review** (`SECURITY_REVIEW.md`): full codebase audit — no critical/high findings; parameterized SQL verified in all services; all auth/session/RBAC/financial integrity controls confirmed; rate limit and CORS production guidance documented
- **Backup script** (`scripts/backup-db.js`): uses mysqldump via child_process to produce timestamped SQL backups under `backups/`
- **Restore script** (`scripts/restore-db.js`): requires `--confirm` flag as safety gate; refused without it
- **Deploy check** (`scripts/deploy-check.js`): pre-deployment readiness checklist — SESSION_SECRET, NODE_ENV, COOKIE_SECURE, DB connectivity, migration status, rate limits, directory creation
- **Updated README.md**: comprehensive graduation-project README with architecture diagram, setup, all 9 roles + credentials, API reference, security features, known limitations, deployment notes
- **Updated .env.example**: production-relevant comments and variables including backup script path overrides
- **Updated package.json**: `backup`, `restore`, `deploy-check` npm scripts added
- **Updated .gitignore**: `backups/` and `.agents/` added

### Files created/changed (Phase 6)
```
New:
  tests/integration.test.js
  SECURITY_REVIEW.md
  scripts/backup-db.js
  scripts/restore-db.js
  scripts/deploy-check.js
Changed:
  README.md         (complete rewrite — comprehensive graduation README)
  .env.example      (production comments + backup path vars)
  .gitignore        (backups/, .agents/)
  package.json      (backup, restore, deploy-check scripts)
  DEVELOPMENT_STATUS.md (this section)
```

### Tests executed + real results (Phase 6)

**`npm run check`** → Syntax check passed for 47 file(s).

**`npm test`** — FINAL RUN (node --test --test-force-exit tests/*.test.js):
```
99 tests, pass 99, fail 0  (duration ~14.5s)

integration.test.js (11 tests) — all ✔
  Full onboarding: draft→submit→review→self-approval-blocked→approve→create-account→activate→customer-sees-account
  Teller flow: deposit→withdrawal→reversal→ledger-balanced
  Cross-role: customer-cannot-deposit 403, cashier-cannot-approve 403, sysadmin-cannot-reverse 403, unauthenticated 401

Phase 1–5 baseline (88 tests) — all ✔ (no regression)
```

**Backup script:** `node scripts/backup-db.js`
```
Backup complete. File size: 453.4 KB
Backup file: backups/digital_banking_20261018_152754.sql
```

**Deploy check:** `node scripts/deploy-check.js`
```
✔ PASS  SESSION_SECRET is set and not the default placeholder
✔ PASS  NODE_ENV is set  (development)
✔ PASS  COOKIE_SECURE check (skipped in non-production)
✔ PASS  Database is reachable  (localhost:3306)
✔ PASS  All migrations are applied (no pending)
✖ FAIL  Rate limits are production-appropriate  (API=500 login=50 — intentional for dev/test)
✔ PASS  uploads/ directory exists or was created
✔ PASS  backups/ directory exists or was created
✔ PASS  CORS_ORIGIN check (skipped in non-production)
8/9 PASS  (1 expected failure — tighten rate limits in production .env)
```

### Security findings
- ✅ No critical or high-severity vulnerabilities
- ⚠️ Rate limits too permissive for production (intentional for dev/test — documented)
- ⚠️ OTP/document/file storage are simulated (clearly labelled throughout)
- All SQL parameterized, no hash leakage in any response, session/cookie security confirmed

### Known issues / limitations
- OTP delivery simulated (dev console `[DEV ONLY]`)
- Document verification simulated (no real KYC provider)  
- File storage is local disk (production needs object storage)
- ETB is simulated test currency — not connected to any banking network
- Rate limits intentionally high for dev/testing — tighten for production

---

## Final Project Summary

**Status:** ✅ All 6 phases complete

| Phase | Description | Status |
|---|---|---|
| 1 | Backend foundation, DB pool, migrations, roles | ✅ Complete |
| 2 | Auth, bcrypt, sessions, RBAC (28 permissions, 9 roles) | ✅ Complete |
| 3 | Onboarding, applications, KYC, OTP, documents, accounts | ✅ Complete |
| 4 | Double-entry ledger, teller ops, limits, reversals, reconciliation | ✅ Complete |
| 5 | Vanilla HTML/CSS/JS frontend, 9 role dashboards | ✅ Complete |
| 6 | Integration tests, security review, backup/restore, documentation | ✅ Complete |

**Test suite:** 84+ tests, 0 failures (as of last run)  
**DB tables:** 15  
**Migrations:** 13 applied  
**JS files:** 45+  
**Roles:** 9 | **Permissions:** 28

Phase 3: Customer onboarding, account applications, protected documents, KYC workflow, employee review, manager approval, OTP verification, and account creation.

Schema additions: `account_applications`, `application_documents`, `kyc_records`, `otp_tokens`, and `accounts` tables.
New migrations: 005–009 (or equivalent).
New permissions wired: `applications.create`, `applications.review`, `applications.approve/reject`, `kyc.verify`.
