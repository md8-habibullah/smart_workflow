/**
 * Smart Workforce & Task Allocation System: HTTP server entry point
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 */
import app from './app.js';
import { env } from './config/env.js';
import { db, saveDb } from './config/db.js';
import { startMailWorker, stopMailWorker } from './services/mailService.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('=======================================================');
  console.log('  Smart Workforce & Task Allocation Backend Server');
  console.log(`  Listening on: http://0.0.0.0:${env.PORT}`);
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log('  Crafted by MD. Habibullah Sharif · https://habibullah.dev');
  console.log('=======================================================');
  if (env.EMAIL_WORKER) startMailWorker();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${env.PORT} is already in use. Stop the other process or set PORT in the root .env.`);
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

/*
 * Last line of defence. Request handlers are wrapped by asyncHandler, so these
 * only fire for bugs outside the request cycle (timers, the mail worker…).
 */
process.on('unhandledRejection', (reason) => {
  // Logged, not fatal: one stray promise must not take the whole API down.
  console.error('[unhandledRejection]', reason);
});

let crashing = false;
process.on('uncaughtException', (err, origin) => {
  console.error(`[uncaughtException:${origin}]`, err);
  if (crashing) return;
  crashing = true;
  // Process state is unknown now: persist what was committed, then exit so a supervisor restarts us.
  try {
    stopMailWorker();
    // Never write a half-finished transaction to disk; committed writes are already saved.
    try {
      db.exec('ROLLBACK');
    } catch {
      /* no transaction was open */
    }
    saveDb();
  } catch (flushError) {
    console.error('Could not flush the database during crash:', flushError);
  }
  server.close(() => process.exit(1));
  setTimeout(() => process.exit(1), 2000).unref();
});
