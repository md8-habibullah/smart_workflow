import crypto from 'crypto';
import { ZodError } from 'zod';
import { env, isTest } from '../config/env.js';
import { cleanupRequestFiles } from './upload.js';

/*
 * Global error handler: every failure leaves the API as the standard envelope
 *   { success: false, message, errors? }
 * with a meaningful status code. Unexpected errors are logged with a short
 * reference id (also returned to the client) and never leak internals outside
 * development.
 */

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

/** Errors raised by express.json()/urlencoded() (body-parser), identified by `type`. */
const BODY_PARSER_ERRORS = {
  'entity.parse.failed': [400, 'Malformed JSON request body.'],
  'entity.too.large': [413, 'Request body is too large.'],
  'parameters.too.many': [413, 'Too many parameters in the request body.'],
  'request.aborted': [400, 'The request was aborted before it was fully received.'],
  'request.size.invalid': [400, 'Request size did not match Content-Length.'],
  'encoding.unsupported': [415, 'Unsupported request body encoding.'],
  'charset.unsupported': [415, 'Unsupported request body charset.']
};

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'File is too large.',
  LIMIT_FILE_COUNT: 'Too many files in one upload (maximum 5).',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field in upload.',
  LIMIT_PART_COUNT: 'Too many parts in the upload.',
  LIMIT_FIELD_KEY: 'Upload field name is too long.',
  LIMIT_FIELD_VALUE: 'Upload field value is too long.',
  LIMIT_FIELD_COUNT: 'Too many fields in the upload.'
};

const send = (res, status, message, errors) =>
  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  // Any files written for a failed request are orphans: remove them.
  cleanupRequestFiles(req);

  // The response is already streaming (e.g. a file download): let Express abort the connection.
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    return send(
      res,
      400,
      err.errors[0]?.message || 'Validation failed for request data',
      err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
    );
  }

  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return send(res, status, MULTER_MESSAGES[err.code] || `Upload failed: ${err.message}`);
  }

  if (err.type && BODY_PARSER_ERRORS[err.type]) {
    const [status, message] = BODY_PARSER_ERRORS[err.type];
    return send(res, status, message);
  }

  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return send(res, 401, 'Invalid or expired authentication token.');
  }

  // Our AppError (statusCode) and well-formed http-errors from Express itself (status + expose),
  // e.g. a malformed percent-encoding in a URL parameter.
  if (err.statusCode && !err.status) {
    return send(res, err.statusCode, err.message, err.errors || []);
  }
  const httpStatus = err.statusCode || err.status;
  if (Number.isInteger(httpStatus) && httpStatus >= 400 && httpStatus < 500) {
    return send(res, httpStatus, err.expose === false ? 'Bad request.' : err.message, err.errors || []);
  }

  const sqlite = mapSqliteError(err);
  if (sqlite) return send(res, sqlite.status, sqlite.message);

  // Unexpected: log with a reference the user can quote, never expose internals in production.
  const reference = crypto.randomBytes(4).toString('hex');
  if (!isTest) console.error(`[Unhandled Error ${reference}] ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    reference,
    ...(env.NODE_ENV === 'development' ? { error: { name: err.name, message: err.message, stack: err.stack } } : {})
  });
};
