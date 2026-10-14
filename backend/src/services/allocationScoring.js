/**
 * Smart Workforce & Task Allocation System: allocation scoring core (v2)
 * @author MD. Habibullah Sharif <https://habibullah.dev> (https://github.com/md8-habibullah)
 *
 * Pure functions, no database and no dependencies, so the algorithm can be
 * reused or tested on its own. allocationEngine.js feeds it with real data.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ Stage 1  Hard filters: required skills at minimum level, project     │
 * │          membership (decided by the caller).                         │
 * │ Stage 2  Five explainable scores, each 0–100:                        │
 * │   Skill fit         35%  priority-aware: experts for critical work,  │
 * │                          "just qualified" people for routine work    │
 * │   Deadline fit      25%  earliest-deadline-first schedule simulation │
 * │                          incl. damage to the person's other tasks    │
 * │   Workload balance  20%  projected utilisation over the horizon      │
 * │   Focus             10%  fewer parallel tasks; same project helps    │
 * │   Fairness          10%  rotates work (time-decayed recent picks)    │
 * │ Stage 3  Batch planning: regret-based greedy ("most constrained task │
 * │          first") with incremental re-scoring.                        │
 * └──────────────────────────────────────────────────────────────────────┘
 */

export const ALGORITHM_VERSION = '2.0';

export const WEIGHTS = Object.freeze({
  skillMatch: 0.35,
  deadlineFit: 0.25,
  workloadBalance: 0.2,
  focus: 0.1,
  fairness: 0.1
});

export const WORK_DAYS_PER_WEEK = 5;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Planning horizon for utilisation: at least one working week, at most four. */
export const HORIZON_WORKING_DAYS = Object.freeze({ min: 5, max: 20 });
export const FOCUS_PENALTY_PER_TASK = 15;
export const SAME_PROJECT_FOCUS_BONUS = 10;
/** Recent assignments fade with this half-life-like time constant (days). */
export const FAIRNESS_DECAY_DAYS = 7;
export const DISPLACEMENT_PENALTY = 15;

/**
 * How much "excess" expertise a task of each priority deserves (0 = just
 * meets the minimum, 1 = top of the scale). Keeps experts free for urgent work.
 */
export const EXPERTISE_TARGET = Object.freeze({ CRITICAL: 1, HIGH: 0.75, MEDIUM: 0.5, LOW: 0.25 });

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
export const round1 = (value) => Math.round(value * 10) / 10;

// ------------------------------------------------------------------ skill fit

/**
 * Score for one skill. `excess` is how far above the minimum the person is,
 * scaled to 0–1. The best score (100) is at the priority's target; the
 * furthest point from the target scores 75 (still eligible, just a worse fit).
 */
export const skillComponentScore = (employeeScore, requiredScore, priority = 'HIGH') => {
  const excess = requiredScore >= 100 ? 1 : clamp((employeeScore - requiredScore) / (100 - requiredScore), 0, 1);
  const target = EXPERTISE_TARGET[priority] ?? EXPERTISE_TARGET.MEDIUM;
  const worstDistance = Math.max(target, 1 - target) || 1;
  return 100 - (25 * Math.abs(excess - target)) / worstDistance;
};

export const skillFit = (requiredSkills, employeeSkills, priority) => {
  if (requiredSkills.length === 0) return 100;
  const total = requiredSkills.reduce(
    (sum, req) => sum + skillComponentScore(employeeSkills.get(req.skillId), req.minScore, priority),
    0
  );
  return total / requiredSkills.length;
};

// ------------------------------------------------------------------ schedule simulation

/** Working hours a person can deliver per calendar day (weekends averaged in). */
export const hoursPerCalendarDay = (dailyCapacityHours) => (dailyCapacityHours * WORK_DAYS_PER_WEEK) / 7;

/**
 * Earliest-Deadline-First simulation of one person's queue.
 * EDF (Jackson's rule) minimises the maximum lateness on a single worker, so
 * it is the fairest assumption about how someone will order their work.
 *
 * @param {{id:any, hours:number, deadlineDays:number}[]} jobs  deadlineDays = days from now
 * @param {number} dailyCapacityHours
 * @returns {Map<any, {finishDays:number, lateDays:number}>}
 */
export const simulateEdf = (jobs, dailyCapacityHours) => {
  const rate = hoursPerCalendarDay(dailyCapacityHours);
  const ordered = [...jobs].sort((a, b) => a.deadlineDays - b.deadlineDays || (a.isNew ? 1 : 0) - (b.isNew ? 1 : 0));
  const result = new Map();
  let hoursDone = 0;
  for (const job of ordered) {
    hoursDone += Math.max(job.hours, 0);
    const finishDays = rate > 0 ? hoursDone / rate : Infinity;
    result.set(job.id, { finishDays, lateDays: Math.max(0, finishDays - job.deadlineDays) });
  }
  return result;
};

/**
 * Deadline fit for adding `task` to a person's queue.
 * On time: 70–100 depending on the buffer left. Late: 0–60 depending on how
 * late. Each existing task that the insertion makes late costs 15 points.
 */
export const deadlineFit = (activeJobs, task, dailyCapacityHours) => {
  if (task.deadlineDays <= 0) {
    return { score: 0, finishDays: 0, slackDays: task.deadlineDays, displaced: [], late: true };
  }
  const before = simulateEdf(activeJobs, dailyCapacityHours);
  const newJob = { id: '__new__', hours: task.hours, deadlineDays: task.deadlineDays, isNew: true };
  const after = simulateEdf([...activeJobs, newJob], dailyCapacityHours);
  const mine = after.get('__new__');
  const slackDays = task.deadlineDays - mine.finishDays;

  const displaced = activeJobs.filter((job) => before.get(job.id).lateDays === 0 && after.get(job.id).lateDays > 0);

  let score;
  if (mine.lateDays === 0) {
    const bufferRatio = slackDays / task.deadlineDays; // 0 = just in time, 1 = instant
    score = 70 + 30 * Math.min(1, bufferRatio / 0.5);
  } else {
    score = 60 * (1 - Math.min(1, mine.lateDays / Math.max(task.deadlineDays, 1)));
  }
  score = clamp(score - DISPLACEMENT_PENALTY * displaced.length);

  return { score, finishDays: mine.finishDays, slackDays, displaced, late: mine.lateDays > 0 };
};

// ------------------------------------------------------------------ workload, focus, fairness

/** Utilisation after taking the task, over the horizon until the deadline (1–4 weeks). */
export const workloadBalance = (outstandingHours, taskHours, dailyCapacityHours, deadlineDays) => {
  const workingDays = clamp((Math.max(deadlineDays, 0) * WORK_DAYS_PER_WEEK) / 7, HORIZON_WORKING_DAYS.min, HORIZON_WORKING_DAYS.max);
  const capacity = dailyCapacityHours * workingDays;
  const utilisation = capacity > 0 ? (outstandingHours + taskHours) / capacity : Infinity;
  return { score: clamp(100 * (1 - utilisation)), utilisation, horizonWorkingDays: workingDays };
};

export const focusScore = (activeTaskCount, sharesProject) =>
  clamp(100 - FOCUS_PENALTY_PER_TASK * activeTaskCount + (sharesProject && activeTaskCount > 0 ? SAME_PROJECT_FOCUS_BONUS : 0));

/** recentAssignmentAgesDays: age in days of each recent assignment. 0 recent → 100. */
export const fairnessScore = (recentAssignmentAgesDays) => {
  const load = recentAssignmentAgesDays.reduce((sum, age) => sum + Math.exp(-Math.max(age, 0) / FAIRNESS_DECAY_DAYS), 0);
  return { score: 100 / (1 + 0.5 * load), recentLoad: load };
};

// ------------------------------------------------------------------ one candidate

/**
 * Scores one eligible candidate.
 * @param {object} task       { hours, deadlineDays, priority, projectId, requiredSkills:[{skillId,minScore}] }
 * @param {object} candidate  { dailyCapacityHours, skills: Map, activeJobs:[{id,hours,deadlineDays,projectId}], recentAssignmentAgesDays:[] }
 */
export const scoreCandidate = (task, candidate) => {
  const outstanding = candidate.activeJobs.reduce((sum, job) => sum + job.hours, 0);
  const skill = skillFit(task.requiredSkills, candidate.skills, task.priority);
  const schedule = deadlineFit(candidate.activeJobs, task, candidate.dailyCapacityHours);
  const balance = workloadBalance(outstanding, task.hours, candidate.dailyCapacityHours, task.deadlineDays);
  const sharesProject = candidate.activeJobs.some((job) => job.projectId === task.projectId);
  const focus = focusScore(candidate.activeJobs.length, sharesProject);
  const fairness = fairnessScore(candidate.recentAssignmentAgesDays);

  const scores = {
    skillMatch: skill,
    deadlineFit: schedule.score,
    workloadBalance: balance.score,
    focus,
    fairness: fairness.score
  };
  const total = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + scores[key] * weight, 0);

  return { total, scores, schedule, balance, sharesProject, fairness, outstanding };
};

/** How decisive the ranking is: margin between the best and the runner-up. */
export const confidence = (best, second) => {
  if (best == null) return null;
  if (second == null) return { level: 'ONLY_OPTION', margin: null };
  const margin = round1(best - second);
  return { level: margin >= 10 ? 'CLEAR' : margin >= 4 ? 'GOOD' : 'CLOSE', margin };
};

// ------------------------------------------------------------------ batch planning

export const PRIORITY_URGENCY = Object.freeze({ CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 0 });

/**
 * Allocates many tasks at once.
 *
 * Plain "best person per task, in list order" lets early tasks grab people
 * that later tasks needed more. Instead, every round picks the task with the
 * highest *regret* (best score − second-best score: how much we lose if its
 * best person is taken), boosted by priority and deadline urgency; tasks with
 * a single eligible person go first.
 *
 * Speed: giving a person one more task can only lower (never raise) their
 * score for other tasks: every component is non-increasing in their load. So
 * after a pick, only tasks whose best or runner-up was that person can change
 * their top two; the others are untouched. Scores are recomputed lazily via a
 * per-person version counter. Typical cost is O(T·E) scorings for the first
 * pass plus a small number of re-scans per round, instead of O(T²·E).
 * (Exactness: four components are strictly non-increasing in load; the
 * displacement penalty can, in a rare edge case, rise slightly, so the plan is
 * then a close approximation of a full re-scan. Benchmarks give identical plans.)
 *
 * @param {object[]} tasks       task shapes as for scoreCandidate, plus id
 * @param {object[]} candidates  candidate shapes plus id; copies are used
 * @param {(task, candidate) => string[]} ineligibility  returns failure reasons ([] = eligible)
 */
export const planBatch = (tasks, candidates, ineligibility) => {
  const people = candidates.map((c) => ({ ...c, activeJobs: [...c.activeJobs], recentAssignmentAgesDays: [...c.recentAssignmentAgesDays] }));
  const version = new Int32Array(people.length);

  const entries = tasks.map((task) => {
    const eligible = [];
    people.forEach((person, index) => {
      if (ineligibility(task, person).length === 0) eligible.push(index);
    });
    return {
      task,
      eligible,
      score: new Float64Array(eligible.length),
      seen: new Int32Array(eligible.length).fill(-1),
      best: -1,
      second: -1
    };
  });

  const scoreAt = (entry, k) => {
    const p = entry.eligible[k];
    if (entry.seen[k] !== version[p]) {
      entry.score[k] = scoreCandidate(entry.task, people[p]).total;
      entry.seen[k] = version[p];
    }
    return entry.score[k];
  };
  const refreshTop = (entry) => {
    entry.best = entry.second = -1;
    for (let k = 0; k < entry.eligible.length; k++) {
      const s = scoreAt(entry, k);
      if (entry.best === -1 || s > entry.score[entry.best]) {
        entry.second = entry.best;
        entry.best = k;
      } else if (entry.second === -1 || s > entry.score[entry.second]) {
        entry.second = k;
      }
    }
  };
  entries.forEach(refreshTop);

  const remaining = new Set(entries);
  const assignments = [];
  const unassignable = [];

  while (remaining.size > 0) {
    let pick = null;
    let pickKey = -Infinity;
    for (const entry of remaining) {
      if (entry.best === -1) {
        pick = entry;
        break;
      }
      const regret = entry.second === -1 ? 100 : entry.score[entry.best] - entry.score[entry.second];
      const key = regret + (PRIORITY_URGENCY[entry.task.priority] ?? 0) + (entry.task.deadlineDays < 3 ? 15 : 0);
      if (key > pickKey || (key === pickKey && entry.task.deadlineDays < pick.task.deadlineDays)) {
        pick = entry;
        pickKey = key;
      }
    }

    remaining.delete(pick);
    if (pick.best === -1) {
      unassignable.push(pick.task.id);
      continue;
    }

    const chosen = pick.eligible[pick.best];
    const bestScore = pick.score[pick.best];
    const secondScore = pick.second === -1 ? null : pick.score[pick.second];
    const person = people[chosen];
    assignments.push({
      taskId: pick.task.id,
      employeeId: person.id,
      score: round1(bestScore),
      runnerUp: pick.second === -1 ? null : { employeeId: people[pick.eligible[pick.second]].id, score: round1(secondScore) },
      confidence: confidence(bestScore, secondScore)
    });

    // The chosen person now carries this task.
    person.activeJobs.push({ id: pick.task.id, hours: pick.task.hours, deadlineDays: pick.task.deadlineDays, projectId: pick.task.projectId });
    person.recentAssignmentAgesDays.push(0);
    version[chosen]++;
    for (const entry of remaining) {
      if (entry.best !== -1 && (entry.eligible[entry.best] === chosen || (entry.second !== -1 && entry.eligible[entry.second] === chosen))) {
        refreshTop(entry);
      }
    }
  }

  return { assignments, unassignable };
};
