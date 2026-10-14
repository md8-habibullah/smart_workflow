/*
 * npm run db:migrate
 * Opens the database (which applies any pending migrations, after backing the
 * file up) and prints a summary. Safe to run any number of times.
 */
import { db, migrationReport } from './db.js';
import { SCHEMA_VERSION } from './schema.js';
import { env } from './env.js';

const { from, to, backup } = migrationReport;
console.log(`Database: ${env.DB_FILE}`);
if (from === to) {
  console.log(`Schema is up to date (v${to}). Nothing to migrate.`);
} else if (from === 0) {
  console.log(`New database created at schema v${to} with demo data.`);
} else {
  console.log(`Migrated schema v${from} → v${to}.`);
  if (backup) console.log(`Backup of the previous file: ${backup}`);
}

const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.map((r) => r[0]);
console.log('\nTable            Rows');
for (const t of tables) {
  const count = db.exec(`SELECT COUNT(*) FROM "${t}"`)[0].values[0][0];
  console.log(`${t.padEnd(16)} ${count}`);
}
console.log(`\nLatest schema version supported by this code: v${SCHEMA_VERSION}`);
