import { extname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
]);

const UPLOAD_DIR = config.upload.dir; // relative path; resolved against CWD at runtime

// Ensure upload dir exists (defensive; app.js startup also does this).
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      Object.assign(
        new Error('Invalid file type. Allowed: jpeg, png, gif, pdf'),
        { status: 415 },
      ),
      false,
    );
  }
}

const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
}).single('document');

/**
 * Wraps multer in a promise-compatible middleware so routes can use async/await + next(err).
 * Handles LIMIT_FILE_SIZE (413) and other multer errors.
 */
export function handleUpload(req, res, next) {
  uploadSingle(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        status: 'error',
        error: `File too large. Maximum size is ${config.upload.maxFileSizeMb}MB`,
      });
    }
    err.status = err.status || 400;
    return next(err);
  });
}
