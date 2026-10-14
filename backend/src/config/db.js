import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { runMigrations, SCHEMA_VERSION } from './schema.js';
import { populateSeedData } from './seedData.js';

/*
 * sql.js keeps the whole SQLite database in memory and we persist it to disk
 * after every committed write. Because a single in-memory connection is shared
 * by all requests, every operation goes through one exclusive queue so that an
 * async transaction can never interleave with another request's statements.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inMemory = env.DB_FILE === ':memory:';
const dbDir = path.resolve(__dirname, '../../data');
const dbPath = inMemory ? null : path.resolve(dbDir, env.DB_FILE);

const SQL = await initSqlJs();

const openDatabase = () => {
  if (dbPath && fs.existsSync(dbPath)) {
    return new SQL.Database(fs.readFileSync(dbPath));
  }
  return new SQL.Database();
};

export let db = openDatabase();

/** Writes the database to disk atomically (tmp file + rename). */
export const saveDb = () => {
  if (inMemory) return;
  try {
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(db.export()));
    fs.renameSync(tmp, dbPath);
  } catch (err) {
    console.error('Failed to save SQLite DB to disk:', err.message);
  }
};

const schemaVersionOf = (database) => database.exec('PRAGMA user_version')[0].values[0][0];

/** Details of the last startup migration, reported by `npm run db:migrate`. */
export const migrationReport = { from: 0, to: 0, backup: null };

/** Copies the database file before an upgrade so a failed or unwanted migration can be rolled back. */
const backupBeforeMigration = (fromVersion) => {
  if (inMemory || !fs.existsSync(dbPath) || fromVersion === 0 || fromVersion >= SCHEMA_VERSION) return null;
  const dir = path.join(dbDir, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `${path.basename(dbPath, '.db')}.v${fromVersion}.${stamp}.db`);
  fs.copyFileSync(dbPath, target);
  return target;
};

const initialise = () => {
  // db.export() resets connection pragmas, so foreign keys are re-enabled per statement batch too.
  db.exec('PRAGMA foreign_keys = ON;');
  migrationReport.from = schemaVersionOf(db);
  migrationReport.backup = backupBeforeMigration(migrationReport.from);
  runMigrations(db);
  migrationReport.to = schemaVersionOf(db);
  if (migrationReport.from !== migrationReport.to && !inMemory && migrationReport.from > 0) {
    console.log(`Database migrated v${migrationReport.from} → v${migrationReport.to} (backup: ${migrationReport.backup})`);
  }
  const [{ values }] = db.exec('SELECT COUNT(*) FROM users');
  if (values[0][0] === 0) {
    populateSeedData(db);
  }
  saveDb();
};

initialise();

/** Drops everything and re-creates schema + seed data (used by db:reset and tests). */
export const resetDatabase = () => {
  db.close();
  db = new SQL.Database();
  initialise();
};

// ---------------------------------------------------------------------------
// Low-level statement execution
// ---------------------------------------------------------------------------

const normaliseParams = (params) =>
  params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });

const execute = (sql, params = []) => {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(normaliseParams(params));
    const columns = stmt.getColumnNames();
    if (columns.length > 0) {
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    }
    stmt.step();
  } finally {
    stmt.free();
  }
  const [{ values }] = db.exec('SELECT last_insert_rowid(), changes()');
  return { insertId: Number(values[0][0]), affectedRows: Number(values[0][1]) };
};

const isWrite = (result) => !Array.isArray(result);

// ---------------------------------------------------------------------------
// Exclusive queue
// ---------------------------------------------------------------------------

let tail = Promise.resolve();

const runExclusive = (fn) => {
  const run = tail.then(fn);
  tail = run.catch(() => {});
  return run;
};

/**
 * Executes a single statement. SELECT-like statements resolve to an array of
 * row objects; writes resolve to { insertId, affectedRows }.
 */
export const query = (sql, params = []) =>
  runExclusive(() => {
    db.exec('PRAGMA foreign_keys = ON;');
    const result = execute(sql, params);
    if (isWrite(result)) saveDb();
    return result;
  });

export const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows[0] || null;
};

/**
 * Runs `callback(tx)` inside BEGIN/COMMIT. `tx.query` / `tx.queryOne` have
 * the same contract as the module-level helpers. Any thrown error rolls back.
 */
export const withTransaction = (callback) =>
  runExclusive(async () => {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('BEGIN IMMEDIATE');
    const tx = {
      query: async (sql, params = []) => execute(sql, params),
      queryOne: async (sql, params = []) => execute(sql, params)[0] || null
    };
    try {
      const result = await callback(tx);
      db.exec('COMMIT');
      saveDb();
      return result;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // transaction already closed
      }
      throw error;
    }
  });

/** The default executor; repositories accept an optional `tx` that has the same shape. */
export const defaultExecutor = { query, queryOne };
