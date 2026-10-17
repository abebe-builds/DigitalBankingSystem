-- Migration 005: account_applications and application_documents tables.

CREATE TABLE IF NOT EXISTS account_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_number VARCHAR(20) NOT NULL UNIQUE,
  customer_user_id INT NOT NULL,
  status ENUM('DRAFT','SUBMITTED','UNDER_REVIEW','CORRECTION_REQUIRED','APPROVED','REJECTED','ACCOUNT_CREATED') NOT NULL DEFAULT 'DRAFT',
  account_type ENUM('SAVINGS','CHECKING','FIXED_DEPOSIT') NOT NULL DEFAULT 'SAVINGS',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  national_id VARCHAR(50) NOT NULL,
  nationality VARCHAR(100) NOT NULL DEFAULT 'Ethiopian',
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL DEFAULT NULL,
  city VARCHAR(100) NOT NULL,
  initial_deposit_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
  terms_accepted TINYINT(1) NOT NULL DEFAULT 0,
  privacy_accepted TINYINT(1) NOT NULL DEFAULT 0,
  reviewed_by INT NULL DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  review_notes TEXT NULL DEFAULT NULL,
  approved_by INT NULL DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  approval_notes TEXT NULL DEFAULT NULL,
  rejection_reason TEXT NULL DEFAULT NULL,
  correction_instructions TEXT NULL DEFAULT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_customer FOREIGN KEY (customer_user_id) REFERENCES users(id),
  CONSTRAINT fk_app_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id),
  CONSTRAINT fk_app_approved_by FOREIGN KEY (approved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_app_customer ON account_applications(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_app_status ON account_applications(status);
CREATE INDEX IF NOT EXISTS idx_app_refnum ON account_applications(reference_number);

CREATE TABLE IF NOT EXISTS application_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  document_type ENUM('NATIONAL_ID','PASSPORT','DRIVERS_LICENSE','UTILITY_BILL','SELFIE','OTHER') NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  upload_path VARCHAR(500) NOT NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  verified_by INT NULL DEFAULT NULL,
  verified_at TIMESTAMP NULL DEFAULT NULL,
  verification_notes TEXT NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_application FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_verified_by FOREIGN KEY (verified_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_doc_application ON application_documents(application_id);
