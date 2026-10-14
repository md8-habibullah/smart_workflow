import bcrypt from 'bcryptjs';

/*
 * Demo data. Every account's password is "password123".
 * Relative date offsets (e.g. '+5 days') are evaluated by SQLite at seed time
 * so the demo always has upcoming, overdue and completed work.
 */

export const DEMO_PASSWORD = 'password123';

// [id, email, role, approval_status]
const users = [
  [1, 'superadmin@smartworkflow.org', 'SUPER_ADMIN', 'APPROVED'],
  [2, 'admin@smartworkflow.org', 'ADMIN', 'APPROVED'],
  [3, 'john.doe@smartworkflow.org', 'EMPLOYEE', 'APPROVED'],
  [4, 'jane.smith@smartworkflow.org', 'EMPLOYEE', 'APPROVED'],
  [5, 'alex.jones@smartworkflow.org', 'EMPLOYEE', 'APPROVED'],
  [6, 'sarah.khan@smartworkflow.org', 'EMPLOYEE', 'PENDING'],
  [7, 'rahim.uddin@smartworkflow.org', 'EMPLOYEE', 'APPROVED'],
  [8, 'nusrat.jahan@smartworkflow.org', 'EMPLOYEE', 'APPROVED'],
  [9, 'tanvir.ahmed@smartworkflow.org', 'EMPLOYEE', 'APPROVED']
];

const departments = [
  [1, 'Software Engineering', 'Develops and maintains core software applications'],
  [2, 'UI/UX Design', 'Creates user interface designs, wireframes, and design systems'],
  [3, 'Quality Assurance', 'Performs software testing and quality control'],
  [4, 'Product Management', 'Manages product roadmaps, requirements, and strategy']
];

// [id, user_id, code, full_name, category, department_id, job_position, phone, daily_capacity]
const employees = [
  [1, 1, 'SA001', 'Chief Super Admin', 'Executive Management', 1, 'Chief Technology Officer', '+8801700000000', 8],
  [2, 2, 'EMP001', 'System Administrator', 'Engineering Management', 1, 'Engineering Manager', '+8801700000001', 8],
  [3, 3, 'EMP002', 'John Doe', 'Software Engineering', 1, 'Senior Backend Developer', '+8801700000002', 8],
  [4, 4, 'EMP003', 'Jane Smith', 'UI/UX Design', 2, 'Lead UI/UX Designer', '+8801700000003', 8],
  [5, 5, 'EMP004', 'Alex Jones', 'Software Engineering', 1, 'Flutter Mobile Developer', '+8801700000004', 8],
  [6, 6, 'EMP005', 'Sarah Khan', 'Quality Assurance', 3, 'QA Analyst', '+8801700000005', 8],
  [7, 7, 'EMP006', 'Rahim Uddin', 'Quality Assurance', 3, 'QA Engineer', '+8801700000006', 7],
  [8, 8, 'EMP007', 'Nusrat Jahan', 'Software Engineering', 1, 'Full-Stack Developer', '+8801700000007', 8],
  [9, 9, 'EMP008', 'Tanvir Ahmed', 'Product Management', 4, 'Product Analyst', '+8801700000008', 6]
];

const skills = [
  [1, 'JavaScript', 'Development', 'Modern ES6+ JavaScript development'],
  [2, 'Node.js', 'Development', 'Backend REST API development with Express.js'],
  [3, 'Flutter', 'Mobile', 'Cross-platform mobile development'],
  [4, 'SQL', 'Database', 'Relational database design and queries'],
  [5, 'Graphic Design', 'Design', 'Visual design and vector assets'],
  [6, 'Photoshop', 'Design', 'Raster graphics editing and image manipulation'],
  [7, 'UI/UX Design', 'Design', 'User research, prototyping, and wireframing'],
  [8, 'Video Editing', 'Media', 'Digital video production and editing'],
  [9, 'Software Testing', 'Quality', 'Manual and automated test design'],
  [10, 'Requirements Analysis', 'Product', 'Eliciting and specifying requirements'],
  [11, 'Dart', 'Mobile', 'Dart language fundamentals']
];

// [employee_id, skill_id, level]
const employeeSkills = [
  [3, 1, 'EXPERT'], [3, 2, 'EXPERT'], [3, 4, 'ADVANCED'],
  [4, 5, 'EXPERT'], [4, 6, 'ADVANCED'], [4, 7, 'EXPERT'],
  [5, 3, 'EXPERT'], [5, 11, 'EXPERT'], [5, 1, 'ADVANCED'],
  [6, 9, 'INTERMEDIATE'],
  [7, 9, 'EXPERT'], [7, 4, 'INTERMEDIATE'], [7, 1, 'INTERMEDIATE'],
  [8, 1, 'ADVANCED'], [8, 2, 'ADVANCED'], [8, 3, 'INTERMEDIATE'], [8, 4, 'EXPERT'], [8, 5, 'INTERMEDIATE'],
  [9, 10, 'EXPERT'], [9, 7, 'INTERMEDIATE']
];

// [id, name, description, department_id, start offset, end offset, requires_membership, created_by]
const projects = [
  [1, 'Smart Workforce Management', 'University flagship project for intelligent task allocation', 1, '-14 days', '+60 days', 0, 2],
  [2, 'Corporate Portal Redesign', 'Modernization of corporate web interface and design system', 2, '-7 days', '+45 days', 1, 2],
  [3, 'Mobile Banking QA', 'Quality assurance cycle for the mobile banking release', 3, '-21 days', '+30 days', 0, 1]
];

// [project_id, employee_id]
const projectMembers = [[2, 4], [2, 8], [2, 9]];

// [id, title, description, project_id, priority, hours, deadline offset, status, created_by, created offset, completed offset]
const tasks = [
  [1, 'Database Schema & Migration Setup', 'Design 3NF relational schema and write SQL migrations', 1, 'HIGH', 16, '+5 days', 'IN_PROGRESS', 2, '-6 days'],
  [2, 'Flutter Authentication UI Screens', 'Build Login and Registration forms with Provider state management', 1, 'MEDIUM', 12, '+7 days', 'ASSIGNED', 2, '-4 days'],
  [3, 'Design UI Mockups for Dashboard', 'Create Figma prototypes for Admin and Employee dashboards', 2, 'HIGH', 10, '+3 days', 'REVIEW', 2, '-5 days'],
  [4, 'REST API for Task Allocation', 'Expose allocation engine through secured REST endpoints', 1, 'CRITICAL', 20, '+10 days', 'PENDING', 2, '-1 days'],
  [5, 'Regression Test Suite', 'Write regression tests for the payments module', 3, 'HIGH', 14, '+6 days', 'PENDING', 1, '-2 days'],
  [6, 'Admin Reporting Queries', 'Write SQL reports for workload and project progress', 1, 'MEDIUM', 8, '+4 days', 'PENDING', 2, '-1 days'],
  [7, 'Brand Style Guide', 'Document typography, colour and spacing tokens', 2, 'LOW', 6, '+12 days', 'PENDING', 2, '-1 days'],
  [8, 'Requirement Specification Document', 'Finalize the SRS for the portal redesign', 2, 'MEDIUM', 8, '-2 days', 'IN_PROGRESS', 2, '-9 days'],
  [9, 'Login Flow Smoke Tests', 'Smoke test the login and OTP flows', 3, 'MEDIUM', 5, '-10 days', 'COMPLETED', 1, '-15 days', '-11 days'],
  [10, 'Product Promo Video', 'Edit a 60-second product promo video', 1, 'LOW', 4, '+14 days', 'PENDING', 2, '-1 days'],
  [11, 'Onboarding Flow Wireframes', 'Low-fidelity wireframes for the new-user onboarding flow', 2, 'MEDIUM', 6, '-8 days', 'COMPLETED', 2, '-16 days', '-9 days'],
  [12, 'Seed Data Scripts', 'Realistic demo data for development and testing', 1, 'LOW', 5, '-6 days', 'COMPLETED', 2, '-12 days', '-7 days'],
  [13, 'Push Notification Prototype', 'Proof of concept for mobile push notifications', 1, 'HIGH', 8, '-4 days', 'COMPLETED', 2, '-13 days', '-3 days'],
  [14, 'API Rate Limiting', 'Protect public endpoints with per-IP rate limits', 1, 'HIGH', 6, '-3 days', 'COMPLETED', 2, '-11 days', '-8 days'],
  [15, 'Test Plan for Payments', 'Write the test plan and acceptance criteria for payments', 3, 'MEDIUM', 4, '-2 days', 'COMPLETED', 1, '-9 days', '-4 days']
];

// [task_id, skill_id, min_level]
const taskSkills = [
  [1, 4, 'ADVANCED'], [1, 2, 'INTERMEDIATE'],
  [2, 3, 'ADVANCED'],
  [3, 7, 'ADVANCED'],
  [4, 1, 'ADVANCED'], [4, 2, 'ADVANCED'],
  [5, 9, 'ADVANCED'],
  [6, 4, 'INTERMEDIATE'],
  [7, 5, 'INTERMEDIATE'],
  [8, 10, 'ADVANCED'],
  [9, 9, 'INTERMEDIATE'],
  [10, 8, 'BEGINNER'],
  [11, 7, 'ADVANCED'],
  [12, 4, 'INTERMEDIATE'],
  [13, 3, 'ADVANCED'],
  [14, 2, 'ADVANCED'],
  [15, 9, 'INTERMEDIATE']
];

// [id, task_id, employee_id, assigned_by, assigned offset]
const assignments = [
  [1, 1, 3, 2, '-6 days'],
  [2, 2, 5, 2, '-4 days'],
  [3, 3, 4, 2, '-5 days'],
  [4, 8, 9, 2, '-9 days'],
  [5, 9, 7, 1, '-15 days'],
  [6, 11, 4, 2, '-15 days'],
  [7, 12, 8, 2, '-11 days'],
  [8, 13, 5, 2, '-12 days'],
  [9, 14, 3, 2, '-10 days'],
  [10, 15, 7, 1, '-8 days']
];

// [task_id, employee_id, work_date offset, hours, description]
const workLogs = [
  [1, 3, '-2 days', 4.5, 'Created initial migration scripts and draft ERD.'],
  [1, 3, '-1 days', 3, 'Normalized employee/skill tables to 3NF.'],
  [3, 4, '-3 days', 5, 'Wireframes for admin dashboard.'],
  [3, 4, '-1 days', 3, 'High-fidelity mockups for employee workspace.'],
  [8, 9, '-4 days', 3, 'Stakeholder interviews and first draft.'],
  [9, 7, '-12 days', 5, 'Executed smoke test plan; no blockers found.'],
  [11, 4, '-13 days', 3, 'User journey mapping for onboarding.'],
  [11, 4, '-10 days', 3.5, 'Wireframes for all onboarding steps.'],
  [12, 8, '-10 days', 2.5, 'Department, skill and employee fixtures.'],
  [12, 8, '-8 days', 2, 'Task and assignment fixtures.'],
  [13, 5, '-11 days', 3, 'Firebase messaging setup.'],
  [13, 5, '-6 days', 4, 'Foreground and background notification handling.'],
  [13, 5, '-4 days', 2, 'Bug fixes after review.'],
  [14, 3, '-10 days', 3, 'Rate limiter middleware and configuration.'],
  [14, 3, '-9 days', 2.5, 'Tests for limit headers and 429 responses.'],
  [15, 7, '-6 days', 2, 'Drafted payment test scenarios.'],
  [15, 7, '-5 days', 2, 'Acceptance criteria review with product.']
];

// [task_id, user_id, content]
const comments = [
  [1, 2, 'Please ensure all foreign keys use appropriate CASCADE or SET NULL rules.'],
  [1, 3, 'Done for employees and tasks; reviewing work_logs next.'],
  [3, 4, 'Mockups are ready for review — see the shared Figma link.'],
  [3, 2, 'Looks great. Please double-check colour contrast on the status badges.'],
  [8, 2, 'This is past its deadline. Can you share a revised ETA?'],
  [13, 2, 'Approved. Nice work on the background handling.']
];

// [task_id, actor_user_id, action, details, when (offset from now)]
const history = [
  [9, 1, 'CREATED', 'Task created: Login Flow Smoke Tests', '-15 days'],
  [9, 1, 'ASSIGNED', 'Assigned to Rahim Uddin (EMP006)', '-15 days'],
  [11, 2, 'CREATED', 'Task created: Onboarding Flow Wireframes', '-16 days'],
  [11, 2, 'ASSIGNED', 'Assigned to Jane Smith (EMP003)', '-15 days'],
  [13, 2, 'CREATED', 'Task created: Push Notification Prototype', '-13 days'],
  [13, 2, 'ASSIGNED', 'Assigned to Alex Jones (EMP004)', '-12 days'],
  [12, 2, 'CREATED', 'Task created: Seed Data Scripts', '-12 days'],
  [12, 2, 'AUTO_ASSIGNED', 'Assigned to Nusrat Jahan (EMP007) (score 88)', '-11 days'],
  [9, 1, 'STATUS_CHANGED', 'REVIEW → COMPLETED', '-11 days'],
  [14, 2, 'CREATED', 'Task created: API Rate Limiting', '-11 days'],
  [14, 2, 'ASSIGNED', 'Assigned to John Doe (EMP002)', '-10 days'],
  [8, 2, 'CREATED', 'Task created: Requirement Specification Document', '-9 days'],
  [8, 2, 'ASSIGNED', 'Assigned to Tanvir Ahmed (EMP008)', '-9 days'],
  [11, 2, 'STATUS_CHANGED', 'REVIEW → COMPLETED', '-9 days'],
  [15, 1, 'CREATED', 'Task created: Test Plan for Payments', '-9 days'],
  [15, 1, 'ASSIGNED', 'Assigned to Rahim Uddin (EMP006)', '-8 days'],
  [14, 2, 'STATUS_CHANGED', 'REVIEW → COMPLETED', '-8 days'],
  [12, 2, 'STATUS_CHANGED', 'REVIEW → COMPLETED', '-7 days'],
  [1, 2, 'CREATED', 'Task created: Database Schema & Migration Setup', '-6 days'],
  [1, 2, 'ASSIGNED', 'Assigned to John Doe (EMP002)', '-6 days'],
  [3, 2, 'CREATED', 'Task created: Design UI Mockups for Dashboard', '-5 days'],
  [3, 2, 'ASSIGNED', 'Assigned to Jane Smith (EMP003)', '-5 days'],
  [2, 2, 'CREATED', 'Task created: Flutter Authentication UI Screens', '-4 days'],
  [2, 2, 'ASSIGNED', 'Assigned to Alex Jones (EMP004)', '-4 days'],
  [15, 1, 'STATUS_CHANGED', 'REVIEW → COMPLETED', '-4 days'],
  [13, 2, 'STATUS_CHANGED', 'REVIEW → COMPLETED', '-3 days'],
  [1, 3, 'STATUS_CHANGED', 'ASSIGNED → IN_PROGRESS', '-2 days'],
  [5, 1, 'CREATED', 'Task created: Regression Test Suite', '-2 days'],
  [4, 2, 'CREATED', 'Task created: REST API for Task Allocation', '-1 days'],
  [6, 2, 'CREATED', 'Task created: Admin Reporting Queries', '-1 days'],
  [7, 2, 'CREATED', 'Task created: Brand Style Guide', '-1 days'],
  [10, 2, 'CREATED', 'Task created: Product Promo Video', '-1 days'],
  [1, 3, 'WORK_LOGGED', '3h logged', '-1 days'],
  [3, 4, 'STATUS_CHANGED', 'IN_PROGRESS → REVIEW', '-5 hours']
];

// [user_id, title, message, type]
const notifications = [
  [3, 'New task assigned', 'You have been assigned "Database Schema & Migration Setup".', 'TASK_ASSIGNED'],
  [5, 'New task assigned', 'You have been assigned "Flutter Authentication UI Screens".', 'TASK_ASSIGNED'],
  [2, 'Task ready for review', '"Design UI Mockups for Dashboard" was submitted for review.', 'TASK_REVIEW'],
  [2, 'New registration', 'Sarah Khan registered and is awaiting approval.', 'REGISTRATION']
];

export const populateSeedData = (db) => {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const run = (sql, params) => {
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
  };

  db.exec('BEGIN');
  try {
    for (const d of departments) {
      run('INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)', d);
    }
    for (const [id, email, role, status] of users) {
      run(
        `INSERT OR IGNORE INTO users (id, email, password_hash, role, approval_status, approved_at)
         VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 'APPROVED' THEN DATETIME('now') END)`,
        [id, email, passwordHash, role, status, status]
      );
    }
    for (const e of employees) {
      run(
        `INSERT OR IGNORE INTO employees
           (id, user_id, employee_code, full_name, category, department_id, job_position, phone_number, daily_capacity_hours)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e
      );
    }
    for (const s of skills) {
      run('INSERT OR IGNORE INTO skills (id, name, category, description) VALUES (?, ?, ?, ?)', s);
    }
    for (const es of employeeSkills) {
      run('INSERT OR IGNORE INTO employee_skills (employee_id, skill_id, proficiency_level) VALUES (?, ?, ?)', es);
    }
    for (const [id, name, desc, dept, start, end, membership, by] of projects) {
      run(
        `INSERT OR IGNORE INTO projects
           (id, name, description, department_id, start_date, end_date, requires_membership, created_by)
         VALUES (?, ?, ?, ?, DATE('now', ?), DATE('now', ?), ?, ?)`,
        [id, name, desc, dept, start, end, membership, by]
      );
    }
    for (const pm of projectMembers) {
      run('INSERT OR IGNORE INTO project_members (project_id, employee_id) VALUES (?, ?)', pm);
    }
    for (const [id, title, desc, project, priority, hours, deadline, status, by, created, completed = null] of tasks) {
      run(
        `INSERT OR IGNORE INTO tasks
           (id, title, description, project_id, priority, estimated_hours, deadline, status, created_by,
            created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, DATETIME('now', ?, 'start of day', '+17 hours'), ?, ?,
                 DATETIME('now', ?), DATETIME('now'), CASE WHEN ? IS NOT NULL THEN DATETIME('now', ?) END)`,
        [id, title, desc, project, priority, hours, deadline, status, by, created, completed, completed]
      );
    }
    for (const ts of taskSkills) {
      run('INSERT OR IGNORE INTO task_skills (task_id, skill_id, min_proficiency_level) VALUES (?, ?, ?)', ts);
    }
    for (const [id, task, emp, by, at] of assignments) {
      run(
        `INSERT OR IGNORE INTO task_assignments (id, task_id, employee_id, assigned_by, assigned_at, is_current)
         VALUES (?, ?, ?, ?, DATETIME('now', ?), 1)`,
        [id, task, emp, by, at]
      );
    }
    for (const [task, emp, date, hours, desc] of workLogs) {
      run(
        `INSERT INTO work_logs (task_id, employee_id, work_date, hours_worked, description)
         VALUES (?, ?, DATE('now', ?), ?, ?)`,
        [task, emp, date, hours, desc]
      );
    }
    for (const c of comments) {
      run('INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)', c);
    }
    for (const h of history) {
      run("INSERT INTO task_history (task_id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, DATETIME('now', ?))", h);
    }
    for (const n of notifications) {
      run('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)', n);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};
