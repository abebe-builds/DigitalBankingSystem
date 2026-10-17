CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (code, description) VALUES
  ('system.admin', 'Full system administration'),
  ('users.manage', 'Manage users'),
  ('users.view', 'View users'),
  ('roles.manage', 'Manage roles'),
  ('system.config', 'System configuration'),
  ('accounts.view', 'View all accounts'),
  ('accounts.view.own', 'View own accounts'),
  ('transfers.internal', 'Initiate internal transfers'),
  ('statements.view.own', 'View own statements'),
  ('profile.update', 'Update own profile'),
  ('applications.create', 'Create account applications'),
  ('applications.review', 'Review account applications'),
  ('applications.request_correction', 'Request correction on applications'),
  ('applications.approve', 'Approve account applications'),
  ('applications.reject', 'Reject account applications'),
  ('kyc.verify', 'KYC verification'),
  ('documents.view', 'View documents'),
  ('teller.deposit', 'Teller deposit operations'),
  ('teller.withdraw', 'Teller withdrawal operations'),
  ('transactions.view', 'View transactions'),
  ('support.tickets', 'Manage support tickets'),
  ('accounts.view.limited', 'View limited account info'),
  ('audit.read', 'Read audit logs'),
  ('everything.view', 'View everything (auditor)'),
  ('reconciliation.run', 'Run reconciliation'),
  ('reports.view', 'View reports'),
  ('ledger.view', 'View ledger'),
  ('ledger.post', 'Post to ledger');

-- Customer
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Customer'
    AND p.code IN ('accounts.view.own','transfers.internal','statements.view.own','profile.update');

-- Account Opening Employee
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Account Opening Employee'
    AND p.code IN ('applications.create','applications.review','applications.request_correction');

-- KYC/Compliance Officer
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'KYC/Compliance Officer'
    AND p.code IN ('kyc.verify','applications.review','documents.view');

-- Manager/Authorized Approver
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Manager/Authorized Approver'
    AND p.code IN ('applications.approve','applications.reject','accounts.view','users.view');

-- Cashier/Teller
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Cashier/Teller'
    AND p.code IN ('teller.deposit','teller.withdraw','transactions.view');

-- Customer Support
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Customer Support'
    AND p.code IN ('support.tickets','accounts.view.limited','users.view');

-- Auditor
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Auditor'
    AND p.code IN ('audit.read','everything.view');

-- Operations/Finance
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'Operations/Finance'
    AND p.code IN ('reconciliation.run','reports.view','ledger.view');

-- System Administrator: MUST NOT have ledger.post, teller.deposit, teller.withdraw,
-- transfers.internal, applications.approve, applications.reject, kyc.verify
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM roles r, permissions p
  WHERE r.name = 'System Administrator'
    AND p.code IN ('system.admin','users.manage','roles.manage','system.config','users.view');
