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
    xhr.onerror = () => reject(new ApiError('Upload failed: cannot reach the server.', 0));
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
  post: (path, body = {}) => request('POST', path, { body }),
  patch: (path, body = {}) => request('PATCH', path, { body }),
  put: (path, body = {}) => request('PUT', path, { body }),
  del: (path) => request('DELETE', path),
  upload,
  blob
};
