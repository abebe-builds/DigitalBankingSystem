import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { config } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Default dev origins; override via CORS_ORIGIN (comma-separated) in env if needed.
const corsOrigin = config.corsOrigin
  ? config.corsOrigin
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];

// 1. Security headers
app.use(helmet());
// 2. CORS (permissive in dev, restricted by CORS_ORIGIN in production)
app.use(cors({ origin: config.isProduction ? corsOrigin : true }));
// 3. Dev logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
}
// 4. Rate limit on /api (100 requests / 15 min)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
// 8. 404 for unmatched routes
app.use(notFound);
// 9. Central error handler (last; no stack leaks in production)
app.use(errorHandler);

export default app;
