/*
 * E-mail event catalogue and HTML/text rendering. Pure functions: no DB, no I/O.
 *
 * Every in-app notification type can also go out by e-mail; the super admin
 * can switch individual events off. "Required" events (password-reset links,
 * test messages) are always sent while e-mail is enabled.
 */

export const EMAIL_EVENTS = [
  { type: 'REGISTRATION', group: 'Accounts', label: 'New self-registration (to admins)', path: '/app/approvals' },
  { type: 'ACCOUNT_APPROVED', group: 'Accounts', label: 'Account approved', path: '/login' },
  { type: 'ACCOUNT_REJECTED', group: 'Accounts', label: 'Registration rejected', path: '/' },
  { type: 'ACCOUNT_CREATED', group: 'Accounts', label: 'Account created by an admin', path: '/login' },
  { type: 'ROLE_CHANGED', group: 'Accounts', label: 'Role changed', path: '/app' },
  { type: 'PASSWORD_RESET', group: 'Accounts', label: 'Password reset by an admin', path: '/login' },
  { type: 'PASSWORD_CHANGED', group: 'Accounts', label: 'Password changed via reset link', path: '/login' },
  { type: 'TASK_ASSIGNED', group: 'Tasks', label: 'Task assigned', path: '/app/tasks' },
  { type: 'TASK_UNASSIGNED', group: 'Tasks', label: 'Task taken away / reassigned', path: '/app/tasks' },
  { type: 'TASK_STARTED', group: 'Tasks', label: 'Work started (to admins)', path: '/app/tasks' },
  { type: 'TASK_REVIEW', group: 'Tasks', label: 'Submitted for review (to admins)', path: '/app/tasks' },
  { type: 'TASK_COMPLETED', group: 'Tasks', label: 'Task approved', path: '/app/tasks' },
  { type: 'TASK_CHANGES_REQUESTED', group: 'Tasks', label: 'Changes requested', path: '/app/tasks' },
  { type: 'TASK_CANCELLED', group: 'Tasks', label: 'Task cancelled', path: '/app/tasks' },
  { type: 'TASK_UPDATED', group: 'Tasks', label: 'Task edited', path: '/app/tasks' },
  { type: 'COMMENT', group: 'Collaboration', label: 'New comment', path: '/app/tasks' },
  { type: 'ATTACHMENT', group: 'Collaboration', label: 'Files attached', path: '/app/tasks' },
  { type: 'PASSWORD_RESET_LINK', group: 'System', label: 'Forgot-password link', required: true },
  { type: 'TEST', group: 'System', label: 'Test message', required: true }
];

const EVENT_BY_TYPE = new Map(EMAIL_EVENTS.map((e) => [e.type, e]));

/** Whether an event type should be e-mailed under the given list of disabled types. */
export const isEventEnabled = (type, disabledEvents = []) => {
  const event = EVENT_BY_TYPE.get(type);
  if (event?.required) return true;
  return !disabledEvents.includes(type);
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const joinUrl = (base, path) => `${String(base || '').replace(/\/+$/, '')}${path || ''}`;

/**
 * Builds { subject, text, html } for a message.
 * @param {object} p
 * @param {string} p.title    headline (also the subject)
 * @param {string} p.message  body paragraph
 * @param {string} p.type     event type (decides the default button link)
 * @param {string} p.appUrl   public URL of the frontend
 * @param {string} [p.name]   recipient's name for the greeting
 * @param {string} [p.actionUrl]   overrides the button link (absolute)
 * @param {string} [p.actionLabel]
 * @param {string} [p.footnote]
 */
export const renderEmail = ({ title, message, type, appUrl, name, actionUrl, actionLabel, footnote }) => {
  const event = EVENT_BY_TYPE.get(type);
  const link = actionUrl || joinUrl(appUrl, event?.path ?? '/app');
  const label = actionLabel || 'Open Smart Workforce';
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `${title} · Smart Workforce`;

  const text = [greeting, '', message, '', `${label}: ${link}`, footnote ? `\n${footnote}` : '', '', '— Smart Workforce']
    .filter((line) => line !== undefined)
    .join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f2;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f2;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="background:#054f31;padding:20px 28px;color:#ffffff;font-size:17px;font-weight:700">
          <span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:7px;background:#12b76a;margin-right:8px">&#10003;</span>Smart Workforce
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(title)}</h1>
          <p style="margin:0 0 6px;font-size:15px;color:#334155">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155">${escapeHtml(message)}</p>
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#039855;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">${escapeHtml(label)}</a>
          ${footnote ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#64748b">${escapeHtml(footnote)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
          You received this e-mail because of activity in Smart Workforce &amp; Task Allocation System.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
};
