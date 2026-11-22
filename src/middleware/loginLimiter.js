import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

// Per-IP rate limit for the login endpoint only.
// Max is configurable via RATE_LIMIT_MAX_LOGIN (default 50).
// Set to a low value (e.g. 5) in production .env for tighter control.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitMaxLogin,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', error: 'Too many login attempts, please try again later' },
});
