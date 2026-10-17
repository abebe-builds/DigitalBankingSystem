-- Migration 008: fill permission gaps for Phase 3.
-- All statements use INSERT IGNORE — safe to re-run.

-- Add missing permission codes (applications.create, applications.review, etc. already exist from 003).
INSERT IGNORE INTO permissions (code, description) VALUES
  ('applications.view',   'View account applications'),
  ('applications.update', 'Update application (corrections)'),
  ('documents.upload',    'Upload application documents');

-- Customer: create, view own, update own applications.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Customer'
    AND p.code IN ('applications.create', 'applications.view', 'applications.update');

-- Account Opening Employee: view applications and upload/view documents.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Account Opening Employee'
    AND p.code IN ('applications.view', 'documents.upload', 'documents.view');

-- KYC/Compliance Officer: view applications and upload documents.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'KYC/Compliance Officer'
    AND p.code IN ('applications.view', 'documents.upload');

-- Manager/Authorized Approver: view applications + documents, review, request correction.
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Manager/Authorized Approver'
    AND p.code IN ('applications.view', 'documents.view', 'applications.review', 'applications.request_correction');
