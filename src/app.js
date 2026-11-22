import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { applicationsRouter } from './routes/applications.js';
import { otpRouter } from './routes/otp.js';
import { accountsRouter } from './routes/accounts.js';
import { transactionsRouter } from './routes/transactions.js';
import { reconciliationRouter } from './routes/reconciliation.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Create upload directory at startup (Phase 3)
if (!existsSync(config.upload.dir)) {
  mkdirSync(config.upload.dir, { recursive: true });
}

// Default dev origins; override via CORS_ORIGIN (comma-separated) in env if needed.
const corsOrigin = config.corsOrigin
  ? config.corsOrigin
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

// 1. Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"],
      scriptSrc:      ["'self'", "'unsafe-inline'"],
      scriptSrcAttr:  ["'unsafe-inline'"],
      imgSrc:         ["'self'", 'data:', 'blob:'],
      connectSrc:     ["'self'"],
      fontSrc:        ["'self'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
// 2. CORS with credentials support for session cookies
app.use(cors({ origin: corsOrigin, credentials: true }));
// 3. Dev logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
}
// 4. Rate limit on /api — configurable via RATE_LIMIT_MAX_API (default 500).
// Set lower in production .env; high default prevents test exhaustion.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitMaxApi,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', error: 'Too Many Requests' },
});
app.use('/api', apiLimiter);
// 5. Session middleware
app.use(sessionMiddleware);
// 6. Body parser
app.use(express.json());
// 7. Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/otp', otpRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/reconciliation', reconciliationRouter);
// 8. Serve frontend static files from public/
app.use(express.static(join(__dirname, '../public')));
// 9. Public home page at root
app.get('/', (_req, res) => {
  res.sendFile(join(__dirname, '../public/home.html'));
});
// 10. SPA fallback — authenticated app routes return login shell
app.get(/^\/(?!api)/, (_req, res) => {
  res.sendFile(join(__dirname, '../public/login.html'));
});
// 10. 404 for unmatched routes
app.use(notFound);
// 11. Central error handler (last; no stack leaks in production)
app.use(errorHandler);

export default app;
