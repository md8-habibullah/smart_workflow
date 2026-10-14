/**
 * All timestamps are stored in SQLite's canonical UTC format 'YYYY-MM-DD HH:MM:SS'
 * so that string comparison against DATETIME('now') is correct.
 */
export const toSqlDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

export const toSqlDate = (date) => date.toISOString().slice(0, 10);

/** Parses a stored UTC timestamp back to a JS Date. */
export const fromSqlDateTime = (value) => {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
};
