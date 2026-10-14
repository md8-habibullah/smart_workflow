import app from './app.js';
import { env } from './config/env.js';
import { saveDb } from './config/db.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('=======================================================');
  console.log('  Smart Workforce & Task Allocation Backend Server');
  console.log(`  Listening on: http://0.0.0.0:${env.PORT}`);
  console.log(`  Environment: ${env.NODE_ENV}`);
  console.log('=======================================================');
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
  saveDb();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
