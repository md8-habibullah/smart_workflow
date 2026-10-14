import request from 'supertest';
import app from '../src/app.js';

export const ACCOUNTS = {
  superAdmin: 'superadmin@smartworkflow.org',
  admin: 'admin@smartworkflow.org',
  john: 'john.doe@smartworkflow.org', // employee 3, backend developer
  jane: 'jane.smith@smartworkflow.org', // employee 4, designer
  alex: 'alex.jones@smartworkflow.org', // employee 5, flutter
  rahim: 'rahim.uddin@smartworkflow.org', // employee 7, QA
  nusrat: 'nusrat.jahan@smartworkflow.org', // employee 8, full-stack
  pending: 'sarah.khan@smartworkflow.org' // user 6, pending approval
};

const tokenCache = new Map();

export const login = async (email, password = 'password123') => {
  if (password === 'password123' && tokenCache.has(email)) return tokenCache.get(email);
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.statusCode !== 200) throw new Error(`Login failed for ${email}: ${res.body.message}`);
  tokenCache.set(email, res.body.data.token);
  return res.body.data.token;
};

/** Thin supertest wrapper: api(token).get('/tasks') */
export const api = (token) => {
  const withAuth = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    get: (url) => withAuth(request(app).get(`/api${url}`)),
    post: (url, body = {}) => withAuth(request(app).post(`/api${url}`)).send(body),
    patch: (url, body = {}) => withAuth(request(app).patch(`/api${url}`)).send(body),
    put: (url, body = {}) => withAuth(request(app).put(`/api${url}`)).send(body),
    delete: (url) => withAuth(request(app).delete(`/api${url}`))
  };
};

export const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export { app };
