/**
 * Smart Workforce & Task Allocation System: Express application
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env, IS_VERCEL, isDemoMode, isTest } from './config/env.js';
import { SCHEMA_VERSION } from './config/schema.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import skillRoutes from './routes/skillRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { apiRateLimiter } from './middleware/rateLimiters.js';
import { serveAvatar } from './controllers/attachmentController.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { TOTAL_COUNT_HEADER } from './utils/pagination.js';

const app = express();

app.disable('x-powered-by');
// Correct client IPs (rate limiting) behind Vercel or another reverse proxy.
if (env.TRUST_PROXY) app.set('trust proxy', 1);
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader('X-Crafted-By', 'habibullah.dev');
  next();
});

// In development any origin is accepted (Vite may pick another localhost port).
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.NODE_ENV !== 'production' || env.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    // Lets cross-origin clients read pagination totals and the Allow list of a 405.
    exposedHeaders: [TOTAL_COUNT_HEADER, 'Allow']
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use('/api', apiRateLimiter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
    system: 'Smart Workforce REST API',
    schemaVersion: SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    demoMode: isDemoMode(),
    author: { name: 'MD. Habibullah Sharif', url: 'https://habibullah.dev', github: 'https://github.com/md8-habibullah' }
  });
});

// Profile photos are public but addressed by unguessable random names.
app.get('/api/files/avatars/:name', serveAvatar);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);

// Serve the built React app (frontend/dist) when it exists, with SPA fallback,
// so `npm run build` + `npm start` runs the whole system from one port.
const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
if (!isTest && !IS_VERCEL && fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
