# Smart Allocation Engine (v2)

| | |
| --- | --- |
| Scoring core (pure, dependency-free) | [`backend/src/services/allocationScoring.js`](../../backend/src/services/allocationScoring.js) |
| Data loading and explanations | [`backend/src/services/allocationEngine.js`](../../backend/src/services/allocationEngine.js) |
| Endpoints | `GET /api/tasks/:id/recommendations` (one task) · `POST /api/tasks/auto-allocate` (all pending tasks, `dryRun` for a preview) |
| Tests | [`backend/tests/allocation.test.js`](../../backend/tests/allocation.test.js) |

The engine answers two questions:

1. **Who should do this task?** It ranks every employee with an explainable 0–100 score.
2. **How should all waiting tasks be shared out?** It builds a plan for every pending task at once.

## Stage 1: eligibility (hard filters)

A candidate must satisfy **all** of these, or they are listed as ineligible with the exact reasons:

1. **Active employee:** the account is `role = EMPLOYEE`, `approval_status = APPROVED`, and both the user and the employee profile are active.
2. **Skills:** the candidate holds **every** required skill at or above the minimum proficiency (`BEGINNER=25`, `INTERMEDIATE=50`, `ADVANCED=75`, `EXPERT=100`).
3. **Membership:** if the project has `requires_membership = 1`, the candidate is a project member.

Admins may still assign an ineligible person with `force: true`; the history entry is then tagged `[override]`.

## Stage 2: five explainable scores

```
total = 0.35·SkillFit + 0.25·DeadlineFit + 0.20·WorkloadBalance + 0.10·Focus + 0.10·Fairness
```

| Component | Weight | How it is computed | Why |
| --- | --- | --- | --- |
| **Skill fit** | 35% | Per required skill, `excess = (emp − req)/(100 − req)`, in 0–1. The score is 100 at the priority's *target* excess and 75 at the furthest point. Targets are CRITICAL 1.0, HIGH 0.75, MEDIUM 0.5 and LOW 0.25. The result is the mean over skills, or 100 if no skills are required. | **Expertise conservation.** Critical work gets your best expert. Routine work goes to someone comfortably qualified, keeping experts free for urgent work. |
| **Deadline fit** | 25% | Simulates the person's queue in **earliest-deadline-first** (EDF) order, including the new task. On time: `70 + 30·min(1, buffer/0.5)`, where `buffer` is the share of time to the deadline left over. Late: `60·(1 − min(1, lateness/timeToDeadline))`. The score drops by **15 for every existing task that the new task would push past its deadline**. A passed deadline scores 0. | EDF (Jackson's rule) minimises the maximum lateness on a single worker, so it is a realistic and fair model of how someone orders their work. It also catches the hidden cost of an assignment: making *other* work late. |
| **Workload balance** | 20% | `100·(1 − utilisation)`, where `utilisation = (outstanding + effort) / (dailyCapacity · horizon)`. The horizon is the working days until the deadline, clamped to 5–20. | Accounts for capacity until the deadline, not just "this week". |
| **Focus** | 10% | `100 − 15·activeTasks`, plus 10 if the person already works on the same project | Context switching is costly; staying inside one project is cheaper. |
| **Fairness** | 10% | `100 / (1 + 0.5·Σ e^(−age/7))` over the person's assignments from the last 30 days | Rotates opportunities. A pick from today counts fully; one from 2 weeks ago counts only ~13%. |

**Notes on the inputs:**
- **Hours:** remaining hours (`estimate − logged`) are used everywhere, so logging work frees capacity.
- **Days:** time is measured in calendar days. Capacity per calendar day is `dailyCapacity · 5/7`, which averages weekends in.
- **Tie-breaks:** precise score, then the larger deadline buffer, then name.

Each recommendation also returns **insights** and a **confidence** value:
- **Insights:** projected finish date, buffer in days, the tasks it would displace, utilisation %, whether the person shares the project, and their recent assignments.
- **Confidence:** the margin between first and second place. `CLEAR` means ≥ 10 points, `GOOD` ≥ 4, `CLOSE` < 4, and `ONLY_OPTION` means one eligible person.

### Worked example (seed task 4, "REST API for Task Allocation", CRITICAL)

| Candidate | Skill fit | Deadline fit | Workload | Focus | Fairness | **Total** |
| --- | --- | --- | --- | --- | --- | --- |
| **John Doe** (expert, 1 active task) | 100 | 100 (5 days buffer) | 50 | 95 | 75 | **86.9** |
| Nusrat Jahan (meets the minimum, free) | 75 | 100 (6.4 days buffer) | 65 | 100 | 91 | 83.3 |

Confidence: **CLOSE** (margin 3.6). For CRITICAL work the expertise target is the top of the scale, so the expert wins skill fit 100 vs 75. Nusrat is better on workload, focus and fairness, but not by enough. Change the task to MEDIUM priority and the target moves to halfway, so the ranking flips towards the free, comfortably qualified person. This is the *expertise conservation* idea in action.

## Stage 3: batch planning ("Auto-allocate")

Assigning tasks one by one in list order is *greedy*: an early, easy task can take the only specialist who could do a later, harder task. The planner instead uses **regret-based greedy** ordering (Vogel's approximation idea):

```
repeat until no tasks are left:
    for each remaining task: best and second-best eligible score (cached)
    regret = best − second        (100 if only one person can do it)
    key    = regret + priority urgency (CRITICAL 30, HIGH 20, MEDIUM 10)
                    + 15 if the deadline is < 3 days away
    pick the task with the highest key (tasks nobody can do are reported)
    assign it to its best person and add the task to that person's queue
    re-check only the tasks whose top-2 included that person
```

**Why it is fast.** Giving someone one more task can only **lower** their scores for other tasks. Every component is non-increasing in load, with one rare exception noted in the code. So after each pick, only tasks whose best or runner-up was the chosen person can change their top two. Scores are recomputed lazily with a per-person version counter.

Benchmarks on a laptop (Node 26) with random data, `backend/src/services/allocationScoring.js`:

| Tasks × people | v2 planner (incremental top-2) | First draft (full scan + sort every round) | Avg. score: planner / in-order greedy |
| --- | --- | --- | --- |
| 50 × 100 | 15 ms | 38 ms | 89.7 / 89.4 |
| 200 × 300 | 108 ms | 2.3 s | 87.0 / 86.6 |
| 500 × 1,000 | 0.65 s | 94 s | 88.3 / 88.1 |

`POST /api/tasks/auto-allocate` with `{ "dryRun": true }` returns the plan. It contains assignments with the runner-up and confidence, the tasks nobody can take, and timing stats. Without `dryRun`, the plan is computed and applied in **one transaction**: every assignment is recorded as `AUTO_ASSIGNED`, and the assignees are notified.

## Data loading

`loadAllocationContext` reads everything in **5 queries, however many employees there are**: candidates, skill matrix, active work per person, recent assignments and project members. Scoring then runs in memory.

## Complexity

| Operation | Cost |
| --- | --- |
| Recommendations for one task | O(E · (S + A log A)): E people, S required skills, A active tasks per person (EDF sort) |
| Batch plan | O(T·E) initial scorings + a few re-scans per round, i.e. O(T·E + T²) scorings in practice; O(T²·E) cheap cached comparisons in the worst case |

## Reusing the algorithm

`allocationScoring.js` has **no imports**. Copy it into any JavaScript project and call `scoreCandidate(task, candidate)` or `planBatch(tasks, candidates, ineligibility)`. The JSDoc in the file documents the expected object shapes.

## Tuning

- **Weights:** `WEIGHTS`. Keep the sum at 1; a test checks it.
- **Expertise targets:** `EXPERTISE_TARGET`.
- **Fairness:** `FAIRNESS_DECAY_DAYS`.
- **Penalties:** `DISPLACEMENT_PENALTY`, `FOCUS_PENALTY_PER_TASK`.
- **Horizon:** `HORIZON_WORKING_DAYS`.
- **Batch urgency:** `PRIORITY_URGENCY`.

The UI reads `weights` from the API, but the labels in `frontend/src/pages/tasks/AllocationPage.jsx` mirror the keys.

## Limitations

- Capacity is a weekly average; holidays and leave aren't modelled.
- People are assumed to work one task at a time in EDF order. That is a model, not a promise.
- The batch planner is a strong heuristic, not a proven optimum. An exact assignment, e.g. the Hungarian algorithm or min-cost flow, would need a fixed score matrix, but scores here change as people take work.
