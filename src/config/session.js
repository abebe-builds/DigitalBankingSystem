import expressSession from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { pool } from '../db/pool.js';
import { config } from './env.js';

const MySQLStore = MySQLStoreFactory(expressSession);

export const store = new MySQLStore(
  {
    createDatabaseTable: false,
    // Disable the background expiration-cleanup interval.
    // Expired sessions are cleaned on access; the interval is not needed
    // for a dev/test environment and prevents the process from exiting cleanly.
    clearExpired: false,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  pool,
);

export const sessionMiddleware = expressSession({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.session.cookieSecure,
    maxAge: config.session.maxAgeMs,
  },
});
