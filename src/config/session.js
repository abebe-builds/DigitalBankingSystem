import expressSession from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import { pool } from '../db/pool.js';
import { config } from './env.js';

const MySQLStore = MySQLStoreFactory(expressSession);

const store = new MySQLStore(
  {
    createDatabaseTable: false,
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
