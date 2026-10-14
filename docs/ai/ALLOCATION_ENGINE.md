# Smart Allocation Engine

Source: [`backend/src/services/allocationEngine.js`](../../backend/src/services/allocationEngine.js)
Endpoint: `GET /api/tasks/:id/recommendations` (admin). Used by `assign`, `reassign` and `auto-assign`.

## Stage 1: eligibility (hard filters)

A candidate must satisfy **all** of these, or they are listed as ineligible with the exact reasons:

1. Account is `role = EMPLOYEE`, `approval_status = APPROVED`, user and employee profile both active.
2. Holds **every** required skill at or above the minimum proficiency
   (`BEGINNER=25`, `INTERMEDIATE=50`, `ADVANCED=75`, `EXPERT=100`).
3. If the project has `requires_membership = 1`, the candidate is a project member.

Admins may still assign an ineligible person with `force: true`; the history entry is tagged `[override]`.

## Stage 2: weighted score (0 to 100)

```
total = 0.40·SkillMatch + 0.25·WorkloadBalance + 0.20·Availability + 0.15·DeadlineFit
```

| Component | Formula | Intuition |
| --- | --- | --- |
| **Skill match** | Mean over required skills of `75 + 25·(emp − req)/(100 − req)` (100 if `req = 100`); 100 when no skills required | Meeting the bar scores 75; deeper expertise approaches 100 |
| **Workload balance** | `remainingCapacity / weeklyCapacity · 100`, where `weeklyCapacity = dailyCapacity · 5` and `remainingCapacity = max(0, weekly − outstanding)` | Prefer people with free capacity |
| **Availability** | `max(0, 100 − 15 · activeTaskCount)` | Penalises context switching across many parallel tasks |
| **Deadline fit** | `min(100, hoursFreeBeforeDeadline / effort · 100)`, 0 if the deadline has passed | Can they finish in time? |

Definitions:

- **outstanding** = Σ `max(0, estimated − logged)` over the candidate's current tasks in `ASSIGNED / IN_PROGRESS / REVIEW` (excluding the task being allocated).
- **effort** = remaining hours on this task (minimum 0.5 h).
- **hoursFreeBeforeDeadline** = `workingDaysLeft · dailyCapacity − (remaining hours of their tasks due on/before this deadline)`, where `workingDaysLeft = calendarDaysLeft · 5/7`.

**Ordering:** eligible first → total score ↓ → remaining capacity ↓ → name.

**Warnings** (do not block): deadline already passed; not enough free hours before the deadline; assignment would exceed weekly capacity.

## Worked example (seed data, task "REST API for Task Allocation")

Requires JavaScript ≥ Advanced and Node.js ≥ Advanced; 20 h; deadline in 10 days.

| Candidate | Skills (JS / Node) | Skill | Workload | Avail. | Deadline | **Total** |
| --- | --- | --- | --- | --- | --- | --- |
| John Doe | Expert / Expert | 100 | 79 (8.5 h booked of 40) | 85 (1 task) | 100 | **92** |
| Nusrat Jahan | Advanced / Advanced | 75 | 100 | 100 | 100 | **90** |
| Jane Smith | none | ineligible: lacks JavaScript, Node.js | | | | 0 |

John's deeper expertise outweighs his existing load; if he picked up two more tasks, Nusrat would rank first.

## Auto-assign

`POST /api/tasks/:id/auto-assign` runs the engine **inside the same transaction** as the assignment and picks the top eligible candidate. It returns 409 when nobody is eligible.

## Tuning

Weights and the availability penalty are constants at the top of the engine file (`WEIGHTS`, `AVAILABILITY_PENALTY_PER_TASK`, `WORK_DAYS_PER_WEEK`). The unit tests in `tests/allocation.test.js` assert that weights sum to 1 and pin the skill curve.
