/**
 * Build step for serverless deployment: copies SQLite's WebAssembly binary next
 * to db.js. db.js references it with `new URL('./sql-wasm.wasm', import.meta.url)`,
 * a pattern Vercel's bundler traces, so the file ships with the function.
 * Locally the copy is optional: db.js falls back to node_modules.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const source = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/config/sql-wasm.wasm');

fs.copyFileSync(source, target);
console.log(`Copied ${path.basename(source)} → ${path.relative(process.cwd(), target)}`);
