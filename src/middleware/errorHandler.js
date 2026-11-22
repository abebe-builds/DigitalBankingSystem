import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (config.isProduction) {
    res.status(status).json({
      status: 'error',
      error: status >= 500 ? 'Internal Server Error' : err.message,
    });
  } else {
    res.status(status).json({
      status: 'error',
      error: err.message,
      stack: err.stack,
    });
  }
}

export default errorHandler;
