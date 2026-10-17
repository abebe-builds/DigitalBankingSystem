import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/authorize.js';
import { handleUpload } from '../middleware/upload.js';
import {
  createApplication,
  getApplicationById,
  listApplications,
  updateApplication,
  submitApplication,
  reviewApplication,
  requestCorrection,
  approveApplication,
  rejectApplication,
  createAccountFromApplication,
} from '../services/applicationService.js';
import {
  saveDocument,
  getDocumentsForApplication,
  markDocumentVerified,
} from '../services/documentService.js';

export const applicationsRouter = Router();

// All application routes require authentication
applicationsRouter.use(requireAuth);

/**
 * POST /api/applications
 * Create a new DRAFT application. Customers only (applications.create permission).
 */
applicationsRouter.post('/', requirePermission('applications.create'), async (req, res, next) => {
  try {
    const app = await createApplication(req.user.id, req.body);
    return res.status(201).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * GET /api/applications
 * Customers see only their own. Staff/managers see all.
 */
applicationsRouter.get('/', requirePermission('applications.view'), async (req, res, next) => {
  try {
    const isCustomer = req.user.role_name === 'Customer';
    const opts = {
      customerUserId: isCustomer ? req.user.id : null,
      status: req.query.status || null,
      limit: req.query.limit,
      offset: req.query.offset,
    };
    const result = await listApplications(opts);
    return res.status(200).json({ status: 'ok', ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/applications/:id
 * Customer sees own application; staff sees any.
 */
applicationsRouter.get('/:id', requirePermission('applications.view'), async (req, res, next) => {
  try {
    const isCustomer = req.user.role_name === 'Customer';
    const app = await getApplicationById(
      parseInt(req.params.id, 10),
      isCustomer ? req.user.id : null,
    );
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * PUT /api/applications/:id
 * Update a DRAFT or CORRECTION_REQUIRED application.
 */
applicationsRouter.put('/:id', requirePermission('applications.update'), async (req, res, next) => {
  try {
    const app = await updateApplication(parseInt(req.params.id, 10), req.user.id, req.body);
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/submit
 * Submit a DRAFT or CORRECTION_REQUIRED application.
 */
applicationsRouter.post('/:id/submit', requirePermission('applications.update'), async (req, res, next) => {
  try {
    const app = await submitApplication(parseInt(req.params.id, 10), req.user.id);
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/review
 * Move application to UNDER_REVIEW. Requires applications.review permission.
 */
applicationsRouter.post('/:id/review', requirePermission('applications.review'), async (req, res, next) => {
  try {
    const app = await reviewApplication(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.notes || null,
    );
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/request-correction
 * Move UNDER_REVIEW -> CORRECTION_REQUIRED. Requires applications.request_correction.
 */
applicationsRouter.post('/:id/request-correction', requirePermission('applications.request_correction'), async (req, res, next) => {
  try {
    const app = await requestCorrection(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.correction_instructions,
    );
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/approve
 * Move UNDER_REVIEW -> APPROVED. Requires applications.approve. Approver != reviewer.
 */
applicationsRouter.post('/:id/approve', requirePermission('applications.approve'), async (req, res, next) => {
  try {
    const app = await approveApplication(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.notes || null,
    );
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/reject
 * Move UNDER_REVIEW|SUBMITTED -> REJECTED. Requires applications.reject.
 */
applicationsRouter.post('/:id/reject', requirePermission('applications.reject'), async (req, res, next) => {
  try {
    const app = await rejectApplication(
      parseInt(req.params.id, 10),
      req.user.id,
      req.body.rejection_reason,
    );
    return res.status(200).json({ status: 'ok', application: app });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/create-account
 * Create a bank account from an APPROVED application. Idempotent.
 * Requires applications.approve permission.
 */
applicationsRouter.post('/:id/create-account', requirePermission('applications.approve'), async (req, res, next) => {
  try {
    const result = await createAccountFromApplication(parseInt(req.params.id, 10), req.user.id);
    return res.status(201).json({ status: 'ok', ...result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * POST /api/applications/:id/documents
 * Upload a document for an application. Requires documents.upload permission.
 * NOTE: Actual file storage is SIMULATED. Multer writes to disk; metadata saved to DB.
 */
applicationsRouter.post(
  '/:id/documents',
  requirePermission('documents.upload'),
  handleUpload,
  async (req, res, next) => {
    try {
      const applicationId = parseInt(req.params.id, 10);
      if (!req.file) {
        return res.status(400).json({ status: 'error', error: 'No file uploaded' });
      }
      const document_type = req.body.document_type || 'OTHER';
      const doc = await saveDocument(applicationId, {
        document_type,
        originalname: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path,
      });
      return res.status(201).json({ status: 'ok', document: doc });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
      next(err);
    }
  },
);

/**
 * GET /api/applications/:id/documents
 * Get all documents for an application.
 * Customers see only their own application's documents (storage paths hidden).
 * Staff see any application's documents (storage paths included if needed).
 */
applicationsRouter.get('/:id/documents', requirePermission('documents.view'), async (req, res, next) => {
  try {
    const isCustomer = req.user.role_name === 'Customer';
    if (isCustomer) {
      // Customers can only see documents for their own application — throws 404 if not owner
      await getApplicationById(parseInt(req.params.id, 10), req.user.id);
    }
    const docs = await getDocumentsForApplication(parseInt(req.params.id, 10), !isCustomer);
    return res.status(200).json({ status: 'ok', documents: docs });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
    next(err);
  }
});

/**
 * PATCH /api/applications/:id/documents/:docId/verify
 * Mark a document as verified (SIMULATED — no actual document analysis).
 * Requires documents.view permission.
 */
applicationsRouter.patch(
  '/:id/documents/:docId/verify',
  requirePermission('documents.view'),
  async (req, res, next) => {
    try {
      const doc = await markDocumentVerified(
        parseInt(req.params.docId, 10),
        req.user.id,
        req.body.notes || null,
      );
      return res.status(200).json({ status: 'ok', document: doc });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ status: 'error', error: err.message });
      next(err);
    }
  },
);
