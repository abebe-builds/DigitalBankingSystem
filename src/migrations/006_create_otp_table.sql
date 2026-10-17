-- Migration 006: otp_tokens table for phone/email verification and application approval OTPs.

CREATE TABLE IF NOT EXISTS otp_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  application_id INT NULL DEFAULT NULL,
  purpose ENUM('PHONE_VERIFICATION','EMAIL_VERIFICATION','APPLICATION_APPROVAL') NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  attempts INT NOT NULL DEFAULT 0,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_otp_application FOREIGN KEY (application_id) REFERENCES account_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_otp_user ON otp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_application ON otp_tokens(application_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_tokens(expires_at);
