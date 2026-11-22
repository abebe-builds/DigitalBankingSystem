# Security Review — DigitalBank ETB

**Date:** October 2026  
**Scope:** Full codebase review (Phases 1–5)  
**Status:** ✅ No critical or high-severity findings. Minor items documented below.

---

## 1. Authentication & Session Security

| Check | Result | Notes |
|---|---|---|
| Passwords hashed with bcrypt (rounds=12) | ✅ PASS | `authService.js` uses `bcrypt.hash(plain, config.bcryptRounds)` |
| No plaintext passwords in logs or responses | ✅ PASS | `password_hash` is never included in any API response. `authService.findUserByEmail()` returns it internally only for comparison, never forwarded |
| Session cookie: httpOnly | ✅ PASS | `httpOnly: true` in `session.js` |
| Session cookie: sameSite=lax (CSRF mitigation) | ✅ PASS | `sameSite: 'lax'` in `session.js` |
| Session ID regenerated on login (fixation prevention) | ✅ PASS | `req.session.regenerate()` called before setting session in login route |
| Session secret from environment variable | ✅ PASS | `config.session.secret` from `SESSION_SECRET` env var |
| Production guard: refuses to start with default SESSION_SECRET | ✅ PASS | `env.js` throws at startup if `secret === 'change-me-in-production'` in production |
| Account lockout after failed login attempts | ✅ PASS | `LOGIN_MAX_ATTEMPTS` (default 5), `LOGIN_LOCK_MINUTES` (default 15) |
| Generic login errors (no user enumeration) | ✅ PASS | Both "wrong password" and "unknown email" return the same error message |
| Timing equalization on unknown-email path | ✅ PASS | `dummyVerify()` runs bcrypt.compare against a pre-computed hash (prevents timing-based enumeration) |

---

## 2. Authorization & RBAC

| Check | Result | Notes |
|---|---|---|
| All protected endpoints require authentication | ✅ PASS | `requireAuth` middleware on every protected route |
| RBAC enforced on backend (not just frontend) | ✅ PASS | `requirePermission()` checks DB permission matrix on every request |
| System Administrator excluded from financial permissions | ✅ PASS | Verified in DB: `SELECT p.code FROM permissions p JOIN role_permissions rp... WHERE r.name='System Administrator'` returns only: roles.manage, system.admin, system.config, users.manage, users.view |
| Self-approval prevention | ✅ PASS | `approveApplication()` checks `approver_id !== reviewer_id`, throws 409 if same |
| Cross-customer data access prevented | ✅ PASS | All customer-facing endpoints check `customer_user_id = req.user.id` |
| Role escalation endpoint does not exist | ✅ PASS | `PATCH /api/users/:id/role` returns 404 — no such route |
| `requirePermission` null guard (when called without requireAuth) | ✅ PASS | `authorize.js` returns empty Set and 403 if `req.user` is absent |

---

## 3. SQL Injection Prevention

| Check | Result | Notes |
|---|---|---|
| All queries use parameterized placeholders (?) | ✅ PASS | Full audit of all service files — no string interpolation of user input in SQL |
| Dynamic `IN (?)` clauses use array params | ✅ PASS | mysql2 handles array expansion safely |
| Migration runner uses `multipleStatements:true` on its own isolated connection | ✅ PASS | App pool uses single-statement by default (safer) |

**Audit log of SQL files reviewed:**
- `authService.js` — all parameterized ✅
- `applicationService.js` — all parameterized ✅
- `ledgerService.js` — all parameterized ✅ (uses dedicated connections)
- `accountService.js` — all parameterized ✅
- `otpService.js` — all parameterized ✅
- `documentService.js` — all parameterized ✅
- `reconciliationService.js` — all parameterized ✅
- All route files — pool/conn queries all parameterized ✅

---

## 4. Financial Integrity

| Check | Result | Notes |
|---|---|---|
| Double-entry ledger (every transaction has balanced debit+credit) | ✅ PASS | Enforced in `ledgerService.js`; verified by `verifyLedgerBalance()` |
| `SELECT FOR UPDATE` on bank_accounts (race condition prevention) | ✅ PASS | All financial writes lock the row before reading balance |
| Idempotency keys prevent duplicate transactions | ✅ PASS | `idempotency_key UNIQUE` in DB; service checks before processing |
| Posted ledger entries never mutated | ✅ PASS | No UPDATE/DELETE on `ledger_entries` table in any service; reversals create new entries |
| Overdraft prevention | ✅ PASS | Balance checked before withdrawal and transfer |
| Never trust frontend-supplied balance | ✅ PASS | Balance always read from DB with row lock inside transaction |

---

## 5. Input Validation & Output Encoding

| Check | Result | Notes |
|---|---|---|
| Password policy enforced server-side | ✅ PASS | Min 12 chars, upper, lower, digit, special — in `validatePasswordPolicy()` |
| OTP: 6-digit, bcrypt-hashed, expiring, single-use, attempt-limited | ✅ PASS | `otpService.js`; plaintext OTP logged only in development with `[DEV ONLY]` prefix |
| File upload: mime type filter + size limit | ✅ PASS | multer middleware restricts to images + PDF, max `MAX_FILE_SIZE_MB` |
| Frontend HTML escaping (XSS prevention) | ✅ PASS | `utils.js:escapeHtml()` used throughout view templates |
| Error responses don't leak stack traces in production | ✅ PASS | `errorHandler.js` returns generic messages in production mode |

---

## 6. Helmet / HTTP Security Headers

| Header | Result |
|---|---|
| `X-Content-Type-Options: nosniff` | ✅ Set by Helmet |
| `X-Frame-Options: DENY` | ✅ Set by Helmet |
| `Strict-Transport-Security` | ✅ Set by Helmet (only effective over HTTPS) |
| `Content-Security-Policy` | ✅ Set (allows self + inline styles for UI) |
| `X-Powered-By` header removed | ✅ Removed by Helmet |

---

## 7. Rate Limiting

| Limiter | Config | Notes |
|---|---|---|
| API-wide (`/api`) | 500 req/15min (dev) | **Tighten to ≤100 in production via `RATE_LIMIT_MAX_API`** |
| Login endpoint | 50 req/15min (dev) | **Tighten to ≤5–10 in production via `RATE_LIMIT_MAX_LOGIN`** |

---

## 8. Findings & Recommendations

### ✅ No critical or high-severity vulnerabilities found.

### Medium — Rate limits too permissive for production (non-blocking for dev/demo)
- **Risk:** Dev defaults (500 API, 50 login) are high to prevent test exhaustion. Fine for dev; must be lowered for production.
- **Fix:** Set `RATE_LIMIT_MAX_API=100` and `RATE_LIMIT_MAX_LOGIN=5` in production `.env`.

### Low — CORS allows all origins in development (`origin: true` fallback removed in Phase 5)
- **Status:** Fixed in Phase 5. Dev CORS is now restricted to `localhost:3000`.
- **Production:** Set `CORS_ORIGIN=https://yourdomain.com` in production `.env`.

### Low — OTP delivery is simulated (intentional for demo)
- **Risk:** No real SMS/email — OTP is logged in dev console.
- **Fix for production:** Integrate an authorized SMS gateway (e.g., Twilio, Africastalking). See `otpService.js` `createOTP()` for the insertion point.

### Low — File storage is local disk (intentional for demo)
- **Risk:** Local disk not suitable for multi-server production deployment.
- **Fix for production:** Replace multer disk storage with an S3-compatible object storage provider.

### Info — Identity document verification is simulated
- Documents are stored but not genuinely verified against any KYC provider.
- Label maintained in code and API responses.
- **Production:** Integrate an approved KYC provider and update `documentService.markDocumentVerified()`.

### Info — SESSION_SECRET in `.env` uses the dev placeholder
- The app correctly refuses to start in production with the default value.
- Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## 9. Production Security Checklist

Before going live, complete all of the following:

- [ ] Set `SESSION_SECRET` to a 64-byte random hex string
- [ ] Set `NODE_ENV=production`
- [ ] Set `COOKIE_SECURE=true` (requires HTTPS)
- [ ] Serve over HTTPS (reverse proxy: nginx/caddy with Let's Encrypt)
- [ ] Set `RATE_LIMIT_MAX_API=100` and `RATE_LIMIT_MAX_LOGIN=5`
- [ ] Set `CORS_ORIGIN=https://yourdomain.com`
- [ ] Integrate real SMS/email provider for OTP delivery
- [ ] Replace local file storage with object storage (S3-compatible)
- [ ] Integrate real KYC provider
- [ ] Run `node scripts/backup-db.js` on a schedule (cron)
- [ ] Set up monitoring and alerting on error rates and audit log
- [ ] Restrict MySQL user permissions (create a dedicated DB user — not root)

---

*This review covers the DigitalBank ETB simulation system. This is a graduation project and educational demonstration — not a licensed financial institution.*
