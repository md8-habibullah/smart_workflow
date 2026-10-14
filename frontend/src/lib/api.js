/*
 * Minimal fetch-based API client.
 *  - GET helpers resolve to the `data` field of the backend envelope.
 *  - Write helpers (post/patch/del) resolve to the whole envelope ({ success, message, data }).
 *  - Every failure is thrown as an ApiError carrying the backend's message.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'swta.token';

export class ApiError extends Error {
  constructor(message, status = 0, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) — session lasts for this tab only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
};

let unauthorizedHandler = null;
/** Registers a callback fired when an authenticated request comes back 401. */
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

const buildUrl = (path, query) => {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};

async function request(method, path, { body, query } = {}) {
  const token = tokenStore.get();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('Cannot reach the server. Make sure the backend is running (cd backend && npm start).', 0);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const details = Array.isArray(payload?.errors) ? payload.errors.map((e) => e.message).filter(Boolean) : [];
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status, details);
  }

  return payload ?? { success: true, data: null };
}

export const api = {
  get: (path, query) => request('GET', path, { query }).then((r) => r.data),
  post: (path, body = {}) => request('POST', path, { body }),
  patch: (path, body = {}) => request('PATCH', path, { body }),
  del: (path) => request('DELETE', path)
};
