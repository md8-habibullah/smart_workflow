import request from 'supertest';
import app from '../src/app.js';

describe('GET /api/health', () => {
  it('should return HTTP 200 and UP status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('UP');
  });
});
