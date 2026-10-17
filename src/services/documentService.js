import { pool } from '../db/pool.js';

/**
 * Save a document record after multer has written the file to disk.
 * NOTE: Document storage/verification is SIMULATED. No real KYC integration.
 *
 * @param {number} applicationId
 * @param {object} fileInfo - { document_type, originalname, filename, size, mimetype, path }
 * @returns {Promise<object>} saved document row (without upload_path — never expose to customer)
 */
export async function saveDocument(applicationId, fileInfo) {
  const { document_type, originalname, filename, size, mimetype, path: uploadPath } = fileInfo;
  const [result] = await pool.query(
    `INSERT INTO application_documents
       (application_id, document_type, original_filename, stored_filename, file_size, mime_type, upload_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [applicationId, document_type, originalname, filename, size, mimetype, uploadPath],
  );
  return {
    id: result.insertId,
    application_id: applicationId,
    document_type,
    original_filename: originalname,
    file_size: size,
    mime_type: mimetype,
    is_verified: 0,
    // stored_filename and upload_path intentionally omitted (SIMULATED — not exposed to customers)
  };
}

/**
 * Get all documents for an application.
 * Strips upload_path and stored_filename from the returned objects —
 * these must never be exposed to customers.
 *
 * @param {number} applicationId
 * @param {boolean} includeStoragePaths - true only for internal/staff use
 */
export async function getDocumentsForApplication(applicationId, includeStoragePaths = false) {
  const storageFields = includeStoragePaths ? ', stored_filename, upload_path' : '';
  const [rows] = await pool.query(
    `SELECT id, application_id, document_type, original_filename${storageFields},
            file_size, mime_type, is_verified, verified_by, verified_at,
            verification_notes, created_at
     FROM application_documents
     WHERE application_id = ?
     ORDER BY id`,
    [applicationId],
  );
  return rows;
}

/**
 * Mark a document as verified (SIMULATED — no actual file analysis).
 * Only staff with documents.view permission should call this endpoint.
 *
 * @param {number} documentId
 * @param {number} verifiedByUserId
 * @param {string|null} notes
 */
export async function markDocumentVerified(documentId, verifiedByUserId, notes = null) {
  const [result] = await pool.query(
    `UPDATE application_documents
     SET is_verified = 1, verified_by = ?, verified_at = NOW(), verification_notes = ?
     WHERE id = ?`,
    [verifiedByUserId, notes, documentId],
  );
  if (result.affectedRows === 0) {
    throw Object.assign(new Error('Document not found'), { status: 404 });
  }
  const [rows] = await pool.query(
    `SELECT id, application_id, document_type, original_filename, file_size, mime_type,
            is_verified, verified_by, verified_at, verification_notes, created_at
     FROM application_documents WHERE id = ?`,
    [documentId],
  );
  return rows[0];
}
