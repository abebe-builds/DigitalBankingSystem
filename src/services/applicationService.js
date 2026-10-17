import { randomBytes } from 'node:crypto';
import { pool } from '../db/pool.js';

/**
 * Generate APP-YYYYMMDD-XXXXX reference number. Checks DB for collision (max 5 retries).
 * @returns {Promise<string>}
 */
async function generateReferenceNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Array.from({ length: 5 }, () =>
      chars[randomBytes(1)[0] % chars.length],
    ).join('');
    const ref = `APP-${today}-${suffix}`;
    const [rows] = await pool.query(
      'SELECT id FROM account_applications WHERE reference_number = ?',
      [ref],
    );
    if (rows.length === 0) return ref;
  }
  throw Object.assign(new Error('Could not generate unique reference number'), { status: 500 });
}

/**
 * Generate ETB-YYYYMMDD-XXXXXXXX account number. Checks DB for collision (max 5 retries).
 * @returns {Promise<string>}
 */
async function generateAccountNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Array.from({ length: 8 }, () =>
      chars[randomBytes(1)[0] % chars.length],
    ).join('');
    const num = `ETB-${today}-${suffix}`;
    const [rows] = await pool.query(
      'SELECT id FROM bank_accounts WHERE account_number = ?',
      [num],
    );
    if (rows.length === 0) return num;
  }
  throw Object.assign(new Error('Could not generate unique account number'), { status: 500 });
}

/** Fields a customer may provide when creating/updating a draft application. */
const DRAFT_FIELDS = [
  'account_type', 'first_name', 'last_name', 'date_of_birth',
  'national_id', 'nationality', 'phone', 'email',
  'address_line1', 'address_line2', 'city',
  'initial_deposit_amount', 'currency',
  'terms_accepted', 'privacy_accepted',
];

/** Required fields that must be non-empty for a valid application. */
const REQUIRED_FIELDS = [
  'first_name', 'last_name', 'date_of_birth', 'national_id',
  'phone', 'email', 'address_line1', 'city',
];

/**
 * Create a new DRAFT application for a customer.
 * @param {number} customerUserId
 * @param {object} data  application fields
 * @returns {Promise<object>} the created application
 */
export async function createApplication(customerUserId, data) {
  // Validate required fields
  for (const f of REQUIRED_FIELDS) {
    if (!data[f]) {
      throw Object.assign(new Error(`${f} is required`), { status: 400 });
    }
  }

  const reference_number = await generateReferenceNumber();

  const providedFields = DRAFT_FIELDS.filter(f => data[f] !== undefined);
  const columns = ['customer_user_id', 'reference_number', ...providedFields];
  const values = [customerUserId, reference_number, ...providedFields.map(f => data[f])];
  const placeholders = columns.map(() => '?').join(', ');

  const [result] = await pool.query(
    `INSERT INTO account_applications (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
  return getApplicationById(result.insertId);
}

/**
 * Get application by ID.
 * @param {number} id
 * @param {number|null} customerUserId  if provided, enforces customer_user_id match (returns 404 not 403 to avoid leaking existence)
 * @returns {Promise<object>}
 */
export async function getApplicationById(id, customerUserId = null) {
  const [rows] = await pool.query(
    'SELECT * FROM account_applications WHERE id = ?',
    [id],
  );
  const app = rows[0];
  if (!app) {
    throw Object.assign(new Error('Application not found'), { status: 404 });
  }
  if (customerUserId !== null && app.customer_user_id !== customerUserId) {
    throw Object.assign(new Error('Application not found'), { status: 404 });
  }
  return app;
}

/**
 * List applications. Customers see only their own; staff see all.
 * @param {object} opts
 * @param {number|null} opts.customerUserId  restrict to this customer if set
 * @param {string|null} opts.status  filter by status
 * @param {number} opts.limit
 * @param {number} opts.offset
 */
export async function listApplications({ customerUserId = null, status = null, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (customerUserId !== null) {
    conditions.push('customer_user_id = ?');
    params.push(customerUserId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimitVal = Math.min(parseInt(limit, 10) || 50, 200);
  const safeOffsetVal = parseInt(offset, 10) || 0;

  const [rows] = await pool.query(
    `SELECT * FROM account_applications ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, safeLimitVal, safeOffsetVal],
  );
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM account_applications ${where}`,
    params,
  );
  return { applications: rows, total, limit: safeLimitVal, offset: safeOffsetVal };
}

/**
 * Update a DRAFT or CORRECTION_REQUIRED application (customer only).
 * @param {number} id
 * @param {number} customerUserId
 * @param {object} data  allowed DRAFT_FIELDS only; other fields silently ignored
 * @returns {Promise<object>} updated application
 */
export async function updateApplication(id, customerUserId, data) {
  const app = await getApplicationById(id, customerUserId);
  if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(app.status)) {
    throw Object.assign(
      new Error(`Cannot update application in status ${app.status}`), { status: 409 },
    );
  }
  const allowed = DRAFT_FIELDS.filter(f => data[f] !== undefined);
  if (allowed.length === 0) return app;
  const setClause = allowed.map(f => `${f} = ?`).join(', ');
  const values = [...allowed.map(f => data[f]), id];
  await pool.query(`UPDATE account_applications SET ${setClause} WHERE id = ?`, values);
  return getApplicationById(id);
}

/**
 * DRAFT | CORRECTION_REQUIRED -> SUBMITTED
 * @param {number} id
 * @param {number} customerUserId
 * @returns {Promise<object>} updated application
 */
export async function submitApplication(id, customerUserId) {
  const app = await getApplicationById(id, customerUserId);
  if (app.status !== 'DRAFT' && app.status !== 'CORRECTION_REQUIRED') {
    throw Object.assign(
      new Error(`Cannot submit application in status ${app.status}`), { status: 409 },
    );
  }
  await pool.query(
    `UPDATE account_applications SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = ?`,
    [id],
  );
  return getApplicationById(id);
}

/**
 * SUBMITTED -> UNDER_REVIEW (employee/manager)
 * @param {number} id
 * @param {number} reviewerUserId
 * @param {string|null} notes
 * @returns {Promise<object>} updated application
 */
export async function reviewApplication(id, reviewerUserId, notes = null) {
  const app = await getApplicationById(id);
  if (app.status !== 'SUBMITTED') {
    throw Object.assign(
      new Error(`Cannot review application in status ${app.status}`), { status: 409 },
    );
  }
  await pool.query(
    `UPDATE account_applications
     SET status = 'UNDER_REVIEW', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
     WHERE id = ?`,
    [reviewerUserId, notes, id],
  );
  return getApplicationById(id);
}

/**
 * UNDER_REVIEW -> CORRECTION_REQUIRED (employee/manager)
 * @param {number} id
 * @param {number} reviewerUserId
 * @param {string} instructions  required
 * @returns {Promise<object>} updated application
 */
export async function requestCorrection(id, reviewerUserId, instructions) {
  if (!instructions) {
    throw Object.assign(new Error('correction_instructions is required'), { status: 400 });
  }
  const app = await getApplicationById(id);
  if (app.status !== 'UNDER_REVIEW') {
    throw Object.assign(
      new Error(`Cannot request correction on application in status ${app.status}`), { status: 409 },
    );
  }
  await pool.query(
    `UPDATE account_applications
     SET status = 'CORRECTION_REQUIRED', correction_instructions = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [instructions, reviewerUserId, id],
  );
  return getApplicationById(id);
}

/**
 * UNDER_REVIEW -> APPROVED (manager/approver; approver must differ from reviewer)
 * @param {number} id
 * @param {number} approverId
 * @param {string|null} notes
 * @returns {Promise<object>} updated application
 */
export async function approveApplication(id, approverId, notes = null) {
  const app = await getApplicationById(id);
  if (app.status !== 'UNDER_REVIEW') {
    throw Object.assign(
      new Error(`Cannot approve application in status ${app.status}`), { status: 409 },
    );
  }
  if (app.reviewed_by !== null && app.reviewed_by === approverId) {
    throw Object.assign(
      new Error('Self-approval is not permitted: approver cannot be the same as reviewer'), { status: 409 },
    );
  }
  await pool.query(
    `UPDATE account_applications
     SET status = 'APPROVED', approved_by = ?, approved_at = NOW(), approval_notes = ?
     WHERE id = ?`,
    [approverId, notes, id],
  );
  return getApplicationById(id);
}

/**
 * UNDER_REVIEW | SUBMITTED -> REJECTED (manager/approver)
 * @param {number} id
 * @param {number} rejectorUserId
 * @param {string} reason  required
 * @returns {Promise<object>} updated application
 */
export async function rejectApplication(id, rejectorUserId, reason) {
  if (!reason) {
    throw Object.assign(new Error('rejection_reason is required'), { status: 400 });
  }
  const app = await getApplicationById(id);
  if (!['UNDER_REVIEW', 'SUBMITTED'].includes(app.status)) {
    throw Object.assign(
      new Error(`Cannot reject application in status ${app.status}`), { status: 409 },
    );
  }
  await pool.query(
    `UPDATE account_applications
     SET status = 'REJECTED', rejection_reason = ?, approved_by = ?, approved_at = NOW()
     WHERE id = ?`,
    [reason, rejectorUserId, id],
  );
  return getApplicationById(id);
}

/**
 * APPROVED -> ACCOUNT_CREATED. Creates a bank_accounts row.
 * Idempotent: if a bank_account already exists for this application_id, returns it.
 * @param {number} id  application ID
 * @param {number} creatorUserId
 * @returns {Promise<{application: object, account: object}>}
 */
export async function createAccountFromApplication(id, creatorUserId) {
  const app = await getApplicationById(id);
  if (app.status !== 'APPROVED' && app.status !== 'ACCOUNT_CREATED') {
    throw Object.assign(
      new Error(`Cannot create account from application in status ${app.status}`), { status: 409 },
    );
  }
  // Idempotency: check if account already exists for this application
  const [existing] = await pool.query(
    'SELECT * FROM bank_accounts WHERE application_id = ?',
    [id],
  );
  if (existing.length > 0) {
    return { application: await getApplicationById(id), account: existing[0] };
  }

  const account_number = await generateAccountNumber();
  const [result] = await pool.query(
    `INSERT INTO bank_accounts
       (account_number, customer_user_id, application_id, account_type, currency, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [account_number, app.customer_user_id, id, app.account_type, app.currency, creatorUserId],
  );
  await pool.query(
    `UPDATE account_applications SET status = 'ACCOUNT_CREATED' WHERE id = ?`,
    [id],
  );
  const [accountRows] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [result.insertId]);
  return { application: await getApplicationById(id), account: accountRows[0] };
}
