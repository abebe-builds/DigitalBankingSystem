import dotenv from 'dotenv';

dotenv.config();

function intEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isDevelopment: nodeEnv === 'development',
  port: intEnv('PORT', 3000),
  // Optional override; not in .env.example. Comma-separated list.
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : null,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: intEnv('DB_PORT', 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'digital_banking',
    connectionLimit: intEnv('DB_CONNECTION_LIMIT', 10),
    waitForConnections: true,
    queueLimit: intEnv('DB_QUEUE_LIMIT', 0),
  },
  session: {
    secret: process.env.SESSION_SECRET || '',
    maxAgeMs: intEnv('SESSION_MAX_AGE_MS', 28800000),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
  bcryptRounds: intEnv('BCRYPT_ROUNDS', 12),
  loginMaxAttempts: intEnv('LOGIN_MAX_ATTEMPTS', 5),
  loginLockMinutes: intEnv('LOGIN_LOCK_MINUTES', 15),
};

// Production guard: SESSION_SECRET must be set and must not be the default placeholder.
if (config.isProduction) {
  const secret = config.session.secret;
  if (!secret || secret === 'change-me-in-production') {
    throw new Error(
      'SESSION_SECRET must be set to a strong random value in production. ' +
      'Set the SESSION_SECRET environment variable.',
    );
  }
}

export default config;
