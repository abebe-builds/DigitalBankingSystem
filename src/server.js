import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import app from './app.js';
import { config } from './config/env.js';
import { testConnection } from './db/pool.js';

const isMainModule = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

function start() {
  const port = config.port;
  app.listen(port, async () => {
    console.log(`digital-banking server listening on port ${port} (${config.nodeEnv})`);
    const db = await testConnection();
    console.log(`DB health: ${db.message}`);
  });
}

if (isMainModule) {
  start();
}
