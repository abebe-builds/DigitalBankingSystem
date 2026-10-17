-- Migration 007: bank_accounts table.
-- NOTE: balance columns exist for reference only. Phase 4 implements double-entry ledger.

CREATE TABLE IF NOT EXISTS bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_number VARCHAR(20) NOT NULL UNIQUE,
  customer_user_id INT NOT NULL,
  application_id INT NULL DEFAULT NULL,
  account_type ENUM('SAVINGS','CHECKING','FIXED_DEPOSIT') NOT NULL,
  status ENUM('PENDING_ACTIVATION','ACTIVE','SUSPENDED','CLOSED') NOT NULL DEFAULT 'PENDING_ACTIVATION',
  currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
  balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  available_balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  opened_at TIMESTAMP NULL DEFAULT NULL,
  closed_at TIMESTAMP NULL DEFAULT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ba_customer FOREIGN KEY (customer_user_id) REFERENCES users(id),
  CONSTRAINT fk_ba_application FOREIGN KEY (application_id) REFERENCES account_applications(id),
  CONSTRAINT fk_ba_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_ba_customer ON bank_accounts(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_ba_account_number ON bank_accounts(account_number);
CREATE INDEX IF NOT EXISTS idx_ba_status ON bank_accounts(status);
