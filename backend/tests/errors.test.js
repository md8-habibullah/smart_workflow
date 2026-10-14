import request from 'supertest';
import { ACCOUNTS, api, app, login } from './helpers.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const expectEnvelope = (res, status) => {
  expect(res.statusCode).toBe(status);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  expect(res.body.success).toBe(false);
  expect(typeof res.body.message).toBe('string');
};

describe('Global error handling', () => {
  let admin;
  beforeAll(async () => {
    admin = await login(ACCOUNTS.admin);
  });

  it('malformed JSON body → 400', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expectEnvelope(res, 400);
    expect(res.body.message).toMatch(/malformed json/i);
  });

  it('payload larger than the body limit → 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) }));
    expectEnvelope(res, 413);
  });

  it('unsupported body charset → 415', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json; charset=klingon').send('{}');
    expectEnvelope(res, 415);
  });

  it('unknown /api route → 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expectEnvelope(res, 404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('known route with the wrong method → 405 with Allow header', async () => {
    const res = await request(app).put('/api/health');
    expectEnvelope(res, 405);
    expect(res.headers.allow).toBe('GET, HEAD');
  });

  it('wrong method on a nested router route → 405 listing its methods', async () => {
    const res = await api(admin).put('/tasks/1', {});
    expectEnvelope(res, 405);
    expect(res.headers.allow.split(', ')).toEqual(expect.arrayContaining(['GET', 'PATCH', 'DELETE']));
  });

  it('Zod validation error → 400 with a field list', async () => {
    const res = await api(admin).post('/tasks', { title: 'x' });
    expectEnvelope(res, 400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['title', 'projectId']));
  });

  it('SQLite UNIQUE constraint → 409', async () => {
    const name = `Unique Dept ${Date.now()}`;
    await api(admin).post('/departments', { name });
    const res = await api(admin).post('/departments', { name });
    expectEnvelope(res, 409);
  });

  it('invalid JWT → 401', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', 'Bearer not-a-token');
    expectEnvelope(res, 401);
  });

  it('missing token → 401', async () => {
    const res = await request(app).get('/api/tasks');
    expectEnvelope(res, 401);
  });

  it('forbidden role → 403', async () => {
    const john = await login(ACCOUNTS.john);
    const res = await api(john).get('/employees');
    expectEnvelope(res, 403);
  });

  it('malformed percent-encoding in a URL parameter → 400, not 500', async () => {
    const res = await api(admin).get('/tasks/%E0%A4%A');
    expectEnvelope(res, 400);
  });

  it('invalid id parameter → 400', async () => {
    const res = await api(admin).get('/tasks/abc');
    expectEnvelope(res, 400);
  });

  it('missing resource → 404', async () => {
    const res = await api(admin).get('/tasks/999999');
    expectEnvelope(res, 404);
  });
});

describe('errorHandler unit behaviour', () => {
  const fakeRes = () => {
    const res = { headersSent: false, statusCode: 200, body: null };
    res.status = (s) => ((res.statusCode = s), res);
    res.json = (b) => ((res.body = b), res);
    return res;
  };
  const req = { method: 'GET', originalUrl: '/api/x' };

  it('multer file-size errors → 413', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('File too large'), { name: 'MulterError', code: 'LIMIT_FILE_SIZE' }), req, res, () => {});
    expect(res.statusCode).toBe(413);
    expect(res.body.success).toBe(false);
  });

  it('jsonwebtoken errors → 401', () => {
    const res = fakeRes();
    errorHandler(Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' }), req, res, () => {});
    expect(res.statusCode).toBe(401);
  });

  it('unexpected errors → 500 with a reference and no stack outside development', () => {
    const res = fakeRes();
    errorHandler(new Error('secret internals'), req, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Internal server error occurred.');
    expect(res.body.reference).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(res.body)).not.toMatch(/secret internals/);
  });

  it('delegates to Express when headers were already sent', () => {
    const res = fakeRes();
    res.headersSent = true;
    let forwarded = null;
    errorHandler(new Error('late'), req, res, (e) => (forwarded = e));
    expect(forwarded?.message).toBe('late');
  });
});
