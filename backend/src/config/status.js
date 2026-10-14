/*
 * npm run db:status
 * Read-only: reports the database file's schema version without changing it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { env } from './env.js';
import { SCHEMA_VERSION } from './schema.js';

const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const file = path.join(dataDir, env.DB_FILE);

if (!fs.existsSync(file)) {
  console.log(`No database file at ${file}. It will be created (schema v${SCHEMA_VERSION}, with demo data) on first start.`);
  process.exit(0);
}

const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(file));
const version = db.exec('PRAGMA user_version')[0].values[0][0];
console.log(`Database file:   ${file}`);
console.log(`Schema version:  v${version}`);
console.log(`Code expects:    v${SCHEMA_VERSION}`);
console.log(
  version === SCHEMA_VERSION
    ? 'Status:          up to date'
    : version < SCHEMA_VERSION
      ? `Status:          ${SCHEMA_VERSION - version} migration(s) pending. Run "npm run db:migrate" (a backup is made first).`
      : 'Status:          database is NEWER than this code. Update the code before using it.'
);
const backups = path.join(dataDir, 'backups');
if (fs.existsSync(backups)) {
  const list = fs.readdirSync(backups).filter((f) => f.endsWith('.db'));
  if (list.length) console.log(`Backups:         ${list.length} in ${backups}`);
}
db.close();
