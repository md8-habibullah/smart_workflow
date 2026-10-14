import { z } from 'zod';

/*
 * Optional offset pagination for list endpoints.
 *
 *   GET /api/tasks?limit=25&offset=50
 *
 * - Without `limit` an endpoint keeps returning the full list (backward compatible).
 * - With `limit` it returns at most `limit` rows starting at `offset`.
 * - Either way the number of rows matching the filters is sent in the
 *   `X-Total-Count` response header, so the body shape never changes.
 */

export const MAX_PAGE_SIZE = 200;
export const TOTAL_COUNT_HEADER = 'X-Total-Count';

/** Zod fields to spread into a list query schema. */
export const pageFields = {
  limit: z.coerce
    .number({ invalid_type_error: 'limit must be a number' })
    .int('limit must be a whole number')
    .min(1, 'limit must be at least 1')
    .max(MAX_PAGE_SIZE, `limit cannot exceed ${MAX_PAGE_SIZE}`)
    .optional(),
  offset: z.coerce
    .number({ invalid_type_error: 'offset must be a number' })
    .int('offset must be a whole number')
    .min(0, 'offset cannot be negative')
    .optional()
    .default(0)
};

export const pageQuery = z.object(pageFields);

/** Appends LIMIT/OFFSET when a page size was requested. */
export const withPage = (sql, params, { limit, offset = 0 } = {}) =>
  limit ? { sql: `${sql} LIMIT ? OFFSET ?`, params: [...params, limit, offset] } : { sql, params };

export const setTotalCount = (res, total) => res.set(TOTAL_COUNT_HEADER, String(total));
