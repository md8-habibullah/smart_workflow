/*
 * Minimal fetch-based API client.
 *  - GET helpers resolve to the `data` field of the backend envelope.
 *  - Write helpers (post/patch/del) resolve to the whole envelope ({ success, message, data }).
 *  - Every failure is thrown as an ApiError carrying the backend's message.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const TOKEN_KEY = 'swta.token';

export class ApiError extends Error {
  constructor(message, status = 0, details = [], reference = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    // Server-side log reference for unexpected (500) errors.
    this.reference = reference;
  }
}

/** Network failure or server-side fault: something the user did not cause and cannot fix by editing input. */
export const isUnexpectedError = (error) => !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

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

/*
 * Server reachability, for the "can't reach the server" banner. A request that
 * fails without any HTTP response marks the server unreachable; any response
 * (even an error status) marks it reachable again.
 */
let serverReachable = true;
const reachabilityListeners = new Set();
const setServerReachable = (value) => {
  if (serverReachable === value) return;
  serverReachable = value;
  reachabilityListeners.forEach((fn) => fn());
};
export const serverStatus = {
  isReachable: () => serverReachable,
  subscribe: (fn) => {
    reachabilityListeners.add(fn);
    return () => reachabilityListeners.delete(fn);
  },
  /** Pings the health endpoint; resolves to true when the API answers. */
  check: async () => {
    try {
      const res = await fetch(`${BASE_URL}/health`, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      // Through a proxy a dead API still "answers" with a 5xx, so only a 2xx counts.
      setServerReachable(res.ok);
      return res.ok;
    } catch {
      setServerReachable(false);
      return false;
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

/** Performs the call and returns { payload, response }; throws ApiError on failure. */
async function send(method, path, { body, query } = {}) {
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
    setServerReachable(false);
    throw new ApiError(
      typeof navigator !== 'undefined' && navigator.onLine === false
        ? 'You are offline. Check your internet connection and try again.'
        : 'Cannot reach the server. Make sure the backend is running (npm run dev from the project root).',
      0
    );
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  // A 5xx without our JSON envelope comes from a proxy/gateway (e.g. the Vite dev proxy
  // or a load balancer) whose upstream API is down: treat it as "server unreachable".
  const gatewayFailure = response.status >= 500 && payload === null;
  setServerReachable(!gatewayFailure);
  if (gatewayFailure) {
    throw new ApiError('Cannot reach the server right now. Please try again in a moment.', response.status);
  }

  if (!response.ok || payload?.success === false) {
    const details = Array.isArray(payload?.errors) ? payload.errors.map((e) => e.message).filter(Boolean) : [];
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(payload?.message || `Request failed (${response.status})`, response.status, details, payload?.reference ?? null);
  }

  return { payload: payload ?? { success: true, data: null }, response };
}

const request = (method, path, options) => send(method, path, options).then((r) => r.payload);

/**
 * GET one page of a list endpoint. Resolves to { data, total }, where `total`
 * comes from the X-Total-Count header (null when the server did not send it).
 */
async function page(path, query) {
  const { payload, response } = await send('GET', path, { query });
  const header = response.headers.get('X-Total-Count');
  return { data: payload.data, total: header === null ? null : Number(header) };
}

/**
 * Multipart upload with progress (fetch cannot report upload progress, XHR can).
 * Resolves to the response envelope like the other write helpers.
 */
function upload(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (onProgress) {
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    }
    xhr.onerror = () => {
      setServerReachable(false);
      reject(new ApiError('Upload failed: cannot reach the server.', 0));
    };
    xhr.onload = () => {
      let payload = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.success !== false) return resolve(payload);
      if (xhr.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
      const details = Array.isArray(payload?.errors) ? payload.errors.map((e) => e.message) : [];
      reject(new ApiError(payload?.message || `Upload failed (${xhr.status})`, xhr.status, details));
    };
    xhr.send(formData);
  });
}

/** Authenticated binary download, returned as a Blob (for previews and "save as"). */
async function blob(path, query) {
  const token = tokenStore.get();
  const response = await fetch(buildUrl(path, query), { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {
    throw new ApiError('Cannot reach the server.', 0);
  });
  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      message = (await response.json()).message || message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, response.status);
  }
  return response.blob();
}

/** Triggers a browser download for a Blob. */
export function saveBlob(data, filename) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: (path, query) => request('GET', path, { query }).then((r) => r.data),
  page,
  post: (path, body = {}) => request('POST', path, { body }),
  patch: (path, body = {}) => request('PATCH', path, { body }),
  put: (path, body = {}) => request('PUT', path, { body }),
  del: (path) => request('DELETE', path),
  upload,
  blob
};
