/**
 * Vercel serverless entry point: the whole Express API as one function.
 * Static files (the React build) are served by Vercel's CDN; see vercel.json.
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 */
import app from '../backend/src/app.js';
import { enableOnDemandDelivery } from '../backend/src/services/mailService.js';

// No background timers on serverless: deliver queued e-mail right after it is queued.
enableOnDemandDelivery();

export default app;
