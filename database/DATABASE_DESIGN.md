# Database Design & Normalization Document

## Database Technology
- **DBMS:** MySQL 8.x
- **Storage Engine:** InnoDB (ACID compliant, Row-level locking, Foreign Key constraints)
- **Charset / Collation:** `utf8mb4` / `utf8mb4_unicode_ci`

## Normalization Analysis (Targeting Third Normal Form - 3NF)

### First Normal Form (1NF)
- **Atomic Values:** Every column in every table contains single atomic values. For example, employee skills are stored in a dedicated `employee_skills` junction table rather than comma-separated strings.
- **Unique Rows:** Primary keys defined on all tables (`id` or composite primary keys like `(employee_id, skill_id)`).

### Second Normal Form (2NF)
- **1NF Satisfied.**
- **No Partial Dependencies:** Every non-prime attribute is fully functionally dependent on the entire primary key. In composite primary key tables (`employee_skills`, `task_skills`, `project_members`), columns like `proficiency_level` depend on both `employee_id` AND `skill_id`.

### Third Normal Form (3NF)
- **2NF Satisfied.**
- **No Transitive Dependencies:** Non-key attributes depend ONLY on the primary key.
  - User authentication attributes (`email`, `password_hash`, `role`) are stored in `users`.
  - Employee profile attributes (`full_name`, `job_position`, `daily_capacity_hours`) are in `employees`.
  - Department info (`name`, `description`) is in `departments` and referenced via `department_id`.
  - No column in `employees` transitively determines department details or user passwords.

## Data Dictionary & Key Constraints
- **Foreign Keys:** All relationships enforce referential integrity with explicit `ON DELETE CASCADE` or `ON DELETE SET NULL`.
- **Generated Columns:** `numeric_score` in `employee_skills` and `task_skills` uses MySQL `STORED` generated column for fast algorithm index matching (`BEGINNER`=25, `INTERMEDIATE`=50, `ADVANCED`=75, `EXPERT`=100).
- **Check Constraints:** Enforces positive numbers for `estimated_hours > 0`, `hours_worked > 0`, and valid capacity `daily_capacity_hours BETWEEN 0.1 AND 24`.
