import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';

const passThrough = (req, res, next) => next();

/** Brute-force protection for login/registration. Disabled under test. */
export const authRateLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 50,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' }
    });

/** Generous global ceiling to protect the single-process server. */
export const apiRateLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 60 * 1000,
      limit: 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests, please slow down.' }
    });
