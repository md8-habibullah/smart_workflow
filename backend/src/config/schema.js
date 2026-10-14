import bcrypt from 'bcryptjs';

/*
 * Versioned schema migrations tracked via PRAGMA user_version.
 * Each migration runs once, in order, inside its own transaction.
 * Never edit a released migration — append a new one instead.
 */

const PROFICIENCY_SCORE_CASE = (column) => `
  CASE ${column}
    WHEN 'BEGINNER' THEN 25
    WHEN 'INTERMEDIATE' THEN 50
    WHEN 'ADVANCED' THEN 75
    WHEN 'EXPERT' THEN 100
  END`;

// Hash that shipped with the original seed data. It does not match "password123",
// which is why the original code had a login backdoor. Migration 2 repairs it.
const LEGACY_SEED_HASH = '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW';

const migrations = [
  // 1 — base schema (CREATE IF NOT EXISTS keeps it safe for databases created before versioning)
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE')),
        approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
        is_active INTEGER NOT NULL DEFAULT 1,
        rejection_reason TEXT NULL,
        approved_by INTEGER NULL,
        approved_at TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        employee_code TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Software Engineering',
        department_id INTEGER NULL,
        job_position TEXT NOT NULL,
        phone_number TEXT NULL,
        daily_capacity_hours REAL NOT NULL DEFAULT 8.00 CHECK (daily_capacity_hours > 0 AND daily_capacity_hours <= 24),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'General',
        description TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
      );

      CREATE TABLE IF NOT EXISTS employee_skills (
        employee_id INTEGER NOT NULL,
        skill_id INTEGER NOT NULL,
        proficiency_level TEXT NOT NULL CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
        numeric_score INTEGER GENERATED ALWAYS AS (${PROFICIENCY_SCORE_CASE('proficiency_level')}) STORED,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        PRIMARY KEY (employee_id, skill_id),
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NULL,
        department_id INTEGER NULL,
        start_date TEXT NULL,
        end_date TEXT NULL,
        requires_membership INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS project_members (
        project_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        joined_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        PRIMARY KEY (project_id, employee_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NULL,
        project_id INTEGER NOT NULL,
        priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        estimated_hours REAL NOT NULL CHECK (estimated_hours > 0),
        deadline TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED')),
        created_by INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS task_skills (
        task_id INTEGER NOT NULL,
        skill_id INTEGER NOT NULL,
        min_proficiency_level TEXT NOT NULL CHECK (min_proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
        min_numeric_score INTEGER GENERATED ALWAYS AS (${PROFICIENCY_SCORE_CASE('min_proficiency_level')}) STORED,
        PRIMARY KEY (task_id, skill_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        assigned_by INTEGER NOT NULL,
        assigned_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        is_current INTEGER NOT NULL DEFAULT 1,
        unassigned_at TEXT NULL,
        reassignment_reason TEXT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS work_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        work_date TEXT NOT NULL,
        hours_worked REAL NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
        description TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        actor_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'INFO',
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, approval_status);
      CREATE INDEX IF NOT EXISTS idx_employees_dept_cat ON employees(department_id, category);
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status_deadline ON tasks(status, deadline);
      CREATE INDEX IF NOT EXISTS idx_assignments_task_current ON task_assignments(task_id, is_current);
      CREATE INDEX IF NOT EXISTS idx_assignments_emp_current ON task_assignments(employee_id, is_current);
      CREATE INDEX IF NOT EXISTS idx_work_logs_emp_date ON work_logs(employee_id, work_date);
    `);
  },

  // 2 — completion timestamp, extra indexes, one-current-assignment guarantee, legacy seed password repair
  (db) => {
    const taskColumns = db.exec('PRAGMA table_info(tasks)')[0].values.map((row) => row[1]);
    if (!taskColumns.includes('completed_at')) {
      db.exec('ALTER TABLE tasks ADD COLUMN completed_at TEXT NULL');
    }
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_assignments_one_current
        ON task_assignments(task_id) WHERE is_current = 1;
      CREATE INDEX IF NOT EXISTS idx_work_logs_task ON work_logs(task_id);
      CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
      CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
    `);
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE password_hash = ?');
    stmt.run([bcrypt.hashSync('password123', 10), LEGACY_SEED_HASH]);
    stmt.free();
  }
];

export const SCHEMA_VERSION = migrations.length;

export const runMigrations = (db) => {
  const current = db.exec('PRAGMA user_version')[0].values[0][0];
  for (let version = current + 1; version <= migrations.length; version++) {
    db.exec('BEGIN');
    try {
      migrations[version - 1](db);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Database migration ${version} failed: ${err.message}`);
    }
  }
};
