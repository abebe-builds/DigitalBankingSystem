# Phase 3 Verification Report

**Date**: 2026-10-17  
**Commit**: 9030b55 — feat: Phase 3 — customer onboarding, applications, OTP, document services

---

## 1. npm install

```
multer@1.4.5-lts.1 and uuid@9.0.1 installed (--save-exact)
Both packages verified present in node_modules/
package.json updated with exact versions
```

---

## 2. npm run db:init

```
Database 'digital_banking' ensured (created if not exists).
```

---

## 3. npm run migrate (10 migrations total)

```
Migrations complete. Applied: 0, Skipped: 10.
```

All migrations previously applied in order:
- 001–004: Phase 1+2 migrations (pre-existing)
- 005_create_application_tables.sql — account_applications + application_documents tables
- 006_create_otp_table.sql — otp_tokens table
- 007_create_accounts_table.sql — bank_accounts table
- 008_seed_phase3_permissions.sql — Phase 3 permission codes + role_permissions wiring
- 009_fix_account_number_length.sql — ALTER bank_accounts.account_number VARCHAR(20)→VARCHAR(25)
  (ETB-YYYYMMDD-XXXXXXXX = 22 chars; VARCHAR(20) was too short)
- 010_fix_otp_expires_at.sql — ALTER otp_tokens.expires_at to add explicit DEFAULT
  (MariaDB 10.4 auto-applies ON UPDATE CURRENT_TIMESTAMP to first TIMESTAMP NOT NULL column
   without explicit DEFAULT, which overwrote expires_at on every UPDATE — broken OTP expiry)

---

## 4. npm run check (syntax check)

```
Syntax check passed for 34 file(s).
```

---

## 5. node --test --test-force-exit tests/*.test.js

```
ℹ tests 63
ℹ suites 21
ℹ pass 63
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 19636
Exit code: 0
```

### Breakdown by file

| File | Tests | Pass | Fail |
|------|-------|------|------|
| applications.test.js | 18 | 18 | 0 |
| auth.test.js | 9 | 9 | 0 |
| db.test.js | 2 | 2 | 0 |
| health.test.js | 1 | 1 | 0 |
| migrations.test.js | 1 | 1 | 0 |
| otp.test.js | 9 | 9 | 0 |
| rbac.test.js | 9 | 9 | 0 |
| security.test.js | 5 | 5 | 0 |
| teardown.test.js | 9 | 9 | 0 |

Phase 1+2 baseline (33 tests) preserved. Phase 3 added 30 new tests (18 application + 9 OTP + 3 previously in teardown).

---

## 6. SQL — SHOW TABLES

Tables confirmed in `digital_banking` database:
- roles, users, permissions, role_permissions, sessions (Phase 1+2)
- account_applications, application_documents (migration 005)
- otp_tokens (migration 006)
- bank_accounts (migration 007)
- schema_migrations

---

## Files Created / Modified

### New files
- `src/migrations/005_create_application_tables.sql`
- `src/migrations/006_create_otp_table.sql`
- `src/migrations/007_create_accounts_table.sql`
- `src/migrations/008_seed_phase3_permissions.sql`
- `src/migrations/009_fix_account_number_length.sql`
- `src/migrations/010_fix_otp_expires_at.sql`
- `src/services/applicationService.js`
- `src/services/otpService.js`
- `src/services/documentService.js`
- `src/middleware/upload.js`
- `src/routes/applications.js`
- `src/routes/otp.js`
- `tests/applications.test.js`
- `tests/otp.test.js`

### Modified files (Phase 1+2 untouched otherwise)
- `src/config/env.js` — added otp + upload config blocks
- `src/app.js` — added fs imports, upload dir creation, two new route mounts
- `package.json` — added multer@1.4.5-lts.1, uuid@9.0.1
- `.env` — added OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, UPLOAD_DIR, MAX_FILE_SIZE_MB
- `.env.example` — same additions
- `.gitignore` — added uploads/

---

## Known deviations from spec (both with justification)

1. **Migration 009 (VARCHAR(25))**: Spec says `account_number VARCHAR(20)` but the generated format
   `ETB-YYYYMMDD-XXXXXXXX` = 22 chars. Migration 009 widens to VARCHAR(25). The test regex
   `/^ETB-\d{8}-[A-Z0-9]{8}$/` requires exactly 8 suffix chars = 22 char total.

2. **Migration 010 (expires_at DEFAULT)**: MariaDB 10.4 implicit `ON UPDATE CURRENT_TIMESTAMP`
   on the first `TIMESTAMP NOT NULL` column without explicit DEFAULT overwrites `expires_at`
   on every UPDATE. Migration 010 adds `DEFAULT '2000-01-01 00:00:00'` to disable this behavior.
   The spec migration 006 is the correct logical migration; 010 is a MariaDB-specific fix.
