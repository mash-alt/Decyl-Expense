const request = require('supertest');
const app = require('../app');

describe('GET /api/health', () => {
  it('should return 200 with status "server running"', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'server running' });
  });

  it('should respond with JSON content-type', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});
