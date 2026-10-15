import initSqlJs from 'sql.js';
import { runMigrations, SCHEMA_VERSION } from '../src/config/schema.js';

const OLD = '@smartworkflow.org';
const NEW = '@allocate.habibullah.dev';

const rows = (db, sql) => db.exec(sql)[0]?.values ?? [];

describe('Migration 6: demo accounts leave the old domain', () => {
  let db;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    runMigrations(db);
    // Recreate a database that was seeded before migration 6 existed.
    db.run("INSERT INTO users (email, password_hash) VALUES (?, 'x'), (?, 'x'), (?, 'x'), (?, 'x')", [
      `admin${OLD}`,
      `John.Doe${OLD.toUpperCase()}`,
      `taken${OLD}`,
      `taken${NEW}`
    ]);
    db.run('UPDATE email_settings SET from_email = ?', [`no-reply${OLD}`]);
    db.run("INSERT INTO email_outbox (to_email, subject, text_body, html_body, event_type) VALUES (?, 's', ?, ?, 'TEST')", [
      `admin${OLD}`,
      `Sign in as admin${OLD}`,
      `<p>admin${OLD}</p>`
    ]);
    db.exec('PRAGMA user_version = 5');
    runMigrations(db);
  });

  afterAll(() => db.close());

  it('reaches the latest version', () => {
    expect(rows(db, 'PRAGMA user_version')[0][0]).toBe(SCHEMA_VERSION);
  });

  it('moves accounts to the new domain, keeping the local part', () => {
    const emails = rows(db, 'SELECT email FROM users ORDER BY id').map((r) => r[0]);
    expect(emails).toEqual(expect.arrayContaining([`admin${NEW}`, `John.Doe${NEW}`, `taken${NEW}`]));
  });

  it('leaves an account alone when its new address is already taken', () => {
    expect(rows(db, `SELECT COUNT(*) FROM users WHERE email = 'taken${OLD}'`)[0][0]).toBe(1);
  });

  it('rewrites the sender address and the outbox', () => {
    expect(rows(db, 'SELECT from_email FROM email_settings')[0][0]).toBe(`no-reply${NEW}`);
    const [to, text, html] = rows(db, 'SELECT to_email, text_body, html_body FROM email_outbox')[0];
    expect([to, text, html].join(' ')).not.toContain(OLD);
    expect(to).toBe(`admin${NEW}`);
  });
});
