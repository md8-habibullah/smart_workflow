/*
 * Formatting helpers and display metadata shared across pages.
 * The backend stores UTC timestamps as 'YYYY-MM-DD HH:MM:SS' (no zone), so they
 * must be parsed as UTC before being shown in the viewer's local time.
 */

export const parseServerDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [y, m, d] = text.split('-').map(Number);
    return new Date(y, m - 1, d); // calendar date, local
  }
  const iso = text.includes('T') ? text : text.replace(' ', 'T');
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});
const relFmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export const formatDate = (value) => {
  const d = parseServerDate(value);
  return d ? dateFmt.format(d) : '—';
};

export const formatDateTime = (value) => {
  const d = parseServerDate(value);
  return d ? dateTimeFmt.format(d) : '—';
};

export const timeAgo = (value) => {
  const d = parseServerDate(value);
  if (!d) return '—';
  const seconds = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relFmt.format(seconds, 'second');
  if (abs < 3600) return relFmt.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relFmt.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relFmt.format(Math.round(seconds / 86400), 'day');
  if (abs < 86400 * 365) return relFmt.format(Math.round(seconds / (86400 * 30)), 'month');
  return relFmt.format(Math.round(seconds / (86400 * 365)), 'year');
};

/** Today's date as YYYY-MM-DD in the viewer's local timezone. */
export const todayLocal = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Value for <input type="datetime-local"> from a server timestamp (or Date). */
export const toDateTimeInput = (value) => {
  const d = parseServerDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Converts a datetime-local value (local time) to an ISO string for the API. */
export const fromDateTimeInput = (value) => (value ? new Date(value).toISOString() : '');

export const hours = (value) => {
  const n = Number(value) || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(1)}h`;
};

export const percent = (value) => `${Math.round(Number(value) || 0)}%`;

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';

// ------------------------------------------------------------ display metadata

export const TASK_STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'];

export const STATUS_META = {
  PENDING: { label: 'Unassigned', tone: 'slate' },
  ASSIGNED: { label: 'Assigned', tone: 'blue' },
  IN_PROGRESS: { label: 'In progress', tone: 'amber' },
  REVIEW: { label: 'In review', tone: 'violet' },
  COMPLETED: { label: 'Completed', tone: 'green' },
  CANCELLED: { label: 'Cancelled', tone: 'red' }
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const PRIORITY_META = {
  LOW: { label: 'Low', tone: 'green' },
  MEDIUM: { label: 'Medium', tone: 'blue' },
  HIGH: { label: 'High', tone: 'amber' },
  CRITICAL: { label: 'Critical', tone: 'red' }
};

export const PROFICIENCY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

export const PROFICIENCY_META = {
  BEGINNER: { label: 'Beginner', score: 25, tone: 'slate' },
  INTERMEDIATE: { label: 'Intermediate', score: 50, tone: 'blue' },
  ADVANCED: { label: 'Advanced', score: 75, tone: 'violet' },
  EXPERT: { label: 'Expert', score: 100, tone: 'green' }
};

export const ROLE_META = {
  SUPER_ADMIN: { label: 'Super Admin', tone: 'violet' },
  ADMIN: { label: 'Admin', tone: 'blue' },
  EMPLOYEE: { label: 'Employee', tone: 'slate' }
};

export const WORKLOAD_META = {
  OVERLOADED: { label: 'Overloaded', tone: 'red' },
  OPTIMAL: { label: 'Optimal', tone: 'green' },
  UNDERLOADED: { label: 'Available', tone: 'blue' }
};

/** Verb shown on the button that performs a status transition. */
export const TRANSITION_LABELS = {
  IN_PROGRESS: { default: 'Start work', fromReview: 'Request changes', fromCompleted: 'Reopen' },
  REVIEW: { default: 'Submit for review' },
  COMPLETED: { default: 'Approve & complete' },
  CANCELLED: { default: 'Cancel task' },
  PENDING: { default: 'Reopen task' }
};

export const transitionLabel = (from, to) => {
  const meta = TRANSITION_LABELS[to] || { default: to };
  if (to === 'IN_PROGRESS' && from === 'REVIEW') return meta.fromReview;
  if (to === 'IN_PROGRESS' && from === 'COMPLETED') return meta.fromCompleted;
  return meta.default;
};

export const workloadTone = (pct) => (pct > 100 ? 'red' : pct >= 60 ? 'amber' : 'green');
