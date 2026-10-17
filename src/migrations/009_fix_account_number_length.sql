-- Migration 009: fix bank_accounts.account_number column length.
-- ETB-YYYYMMDD-XXXXXXXX = 3+1+8+1+8 = 21 chars; VARCHAR(20) would truncate.
-- Change to VARCHAR(25) to safely accommodate the format with margin.

ALTER TABLE bank_accounts MODIFY COLUMN account_number VARCHAR(25) NOT NULL;
