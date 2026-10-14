-- Smart Workforce & Task Allocation System
-- Transaction Control Demonstrations (ACID Properties & Rollback Safety)

USE smart_workforce_db;

-- 1. TRANSACTION DEMO: Employee Task Reassignment with Audit History
-- Reassign Task 1 from current employee to new employee (e.g. Employee ID 4)

START TRANSACTION;

-- Step 1: Mark existing active assignment as not current
UPDATE task_assignments
SET is_current = FALSE,
    unassigned_at = NOW(),
    reassignment_reason = 'Reallocated due to high priority workload'
WHERE task_id = 1 AND is_current = TRUE;

-- Step 2: Create new current assignment
INSERT INTO task_assignments (task_id, employee_id, assigned_by, assigned_at, is_current)
VALUES (1, 4, 1, NOW(), TRUE);

-- Step 3: Update task status to ASSIGNED
UPDATE tasks
SET status = 'ASSIGNED', updated_at = NOW()
WHERE id = 1;

-- Step 4: Record history event in task_history
INSERT INTO task_history (task_id, actor_id, action, details)
VALUES (1, 1, 'REASSIGNED', 'Task reassigned to Alex Jones (EMP004)');

-- Commit transaction
COMMIT;


-- 2. TRANSACTION DEMO: User Registration Approval
-- Approve pending user (User ID = 5) and create employee profile atomically

START TRANSACTION;

-- Step 1: Update user status to APPROVED
UPDATE users
SET approval_status = 'APPROVED',
    approved_by = 1,
    approved_at = NOW()
WHERE id = 5 AND approval_status = 'PENDING';

-- Step 2: Insert employee record
INSERT INTO employees (user_id, employee_code, full_name, department_id, job_position, phone_number)
VALUES (5, 'EMP005', 'Sarah Khan', 1, 'Software Engineer', '+8801700000005');

-- Commit transaction
COMMIT;
