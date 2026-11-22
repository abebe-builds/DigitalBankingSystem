import { config } from './env.js';

// No database selected — used to create the database itself.
export const serverConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
};

// With database + pool options — used by the app pool and the migration runner.
export const dbConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  waitForConnections: config.db.waitForConnections,
  queueLimit: config.db.queueLimit,
};
