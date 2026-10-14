import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

/*
 * File uploads are written to UPLOAD_DIR/<kind>/<random hex><ext>.
 * The client's original filename is kept only as metadata in the database and
 * is never used to build a path, so it cannot cause path traversal.
 */

export const UPLOAD_KINDS = { attachments: 'attachments', avatars: 'avatars' };

export const uploadPath = (kind, storedName = '') => path.join(env.UPLOAD_DIR, kind, storedName);

for (const kind of Object.values(UPLOAD_KINDS)) {
  fs.mkdirSync(uploadPath(kind), { recursive: true });
}

const IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp']
};

const DOCUMENT_TYPES = {
  ...IMAGE_TYPES,
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.log', '.md'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls', '.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
};

export const ALLOWED_ATTACHMENT_EXTENSIONS = [...new Set(Object.values(DOCUMENT_TYPES).flat())];

const makeUploader = (kind, allowed, maxBytes, maxFiles) =>
  multer({
    storage: multer.diskStorage({
      destination: uploadPath(kind),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
      }
    }),
    limits: { fileSize: maxBytes, files: maxFiles },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const extensions = allowed[file.mimetype];
      if (!extensions || !extensions.includes(ext)) {
        return cb(badRequest(`File type not allowed: ${file.originalname}`));
      }
      cb(null, true);
    }
  });

export const attachmentUpload = makeUploader(UPLOAD_KINDS.attachments, DOCUMENT_TYPES, env.MAX_UPLOAD_MB * 1024 * 1024, 5).array(
  'files',
  5
);

export const avatarUpload = makeUploader(UPLOAD_KINDS.avatars, IMAGE_TYPES, 2 * 1024 * 1024, 1).single('avatar');

/** Best-effort delete; a missing file is not an error. */
export const removeUploadedFile = (kind, storedName) => {
  if (!storedName) return;
  fs.promises.unlink(uploadPath(kind, path.basename(storedName))).catch(() => {});
};

/** Deletes files multer already wrote when the request fails later (validation, permissions…). */
export const cleanupRequestFiles = (req) => {
  const files = req.files || (req.file ? [req.file] : []);
  for (const f of files) fs.promises.unlink(f.path).catch(() => {});
};
