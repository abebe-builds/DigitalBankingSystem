-- Migration 010: fix otp_tokens.expires_at column.
-- In MariaDB 10.4, the first TIMESTAMP NOT NULL column without explicit DEFAULT
-- gets implicit ON UPDATE CURRENT_TIMESTAMP behavior, which would overwrite
-- expires_at whenever the row is updated (e.g. when incrementing attempts).
-- Setting an explicit DEFAULT disables this implicit behavior.

ALTER TABLE otp_tokens
  MODIFY COLUMN expires_at TIMESTAMP NOT NULL DEFAULT '2000-01-01 00:00:00';
