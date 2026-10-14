import { ZodError } from 'zod';
import { isTest } from '../config/env.js';
import { cleanupRequestFiles } from './upload.js';

/** Maps SQLite constraint failures to meaningful HTTP responses. */
const mapSqliteError = (err) => {
  const msg = String(err.message || '');
  if (msg.includes('UNIQUE constraint failed')) {
    return { status: 409, message: 'A record with the same unique value already exists.' };
  }
  if (msg.includes('FOREIGN KEY constraint failed')) {
    return { status: 400, message: 'Referenced record does not exist or is still in use.' };
  }
  if (msg.includes('CHECK constraint failed') || msg.includes('NOT NULL constraint failed')) {
    return { status: 400, message: 'Submitted data violates a database constraint.' };
  }
  return null;
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Any files written for a failed request are orphans: remove them.
  cleanupRequestFiles(req);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: err.errors[0]?.message || 'Validation failed for request data',
      errors: err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
    });
  }

  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'File is too large.',
      LIMIT_FILE_COUNT: 'Too many files in one upload (maximum 5).',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field in upload.'
    };
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false,
      message: messages[err.code] || `Upload failed: ${err.message}`
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Malformed JSON request body.' });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || []
    });
  }

  const sqlite = mapSqliteError(err);
  if (sqlite) {
    return res.status(sqlite.status).json({ success: false, message: sqlite.message });
  }

  if (!isTest) console.error('[Unhandled Error]:', err);
  return res.status(500).json({ success: false, message: 'Internal server error occurred.' });
};
