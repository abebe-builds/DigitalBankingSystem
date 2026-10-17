import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === 'test',
  message: { status: 'error', error: 'Too many login attempts, please try again later' },
});
