/**
 * Smart Workforce & Task Allocation System: HTTP server entry point
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 */
import app from './app.js';
import { env } from './config/env.js';
import { saveDb } from './config/db.js';
import { startMailWorker, stopMailWorker } from './services/mailService.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('=======================================================');
  console.log('  Smart Workforce & Task Allocation Backend Server');
  console.log(`  Listening on: http://0.0.0.0:${env.PORT}`);
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log('  Crafted by ${NAME} · ${SITE}');
  console.log('=======================================================');
  if (env.EMAIL_WORKER) startMailWorker();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. Stop the other process or set PORT in backend/.env.`);
  } else {
    console.error('Server failed to start:', err);
  }
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`${signal} received: flushing database and shutting down.`);
  stopMailWorker();
  saveDb();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
