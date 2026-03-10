const request = require('supertest');

// Set up mocks before importing app
const { mockDb, mockBatch, mockDocRef } = require('./mocks');
const { parseExpenseMessage } = require('../services/geminiService');

const app = require('../app');

const SAMPLE_EXPENSES = [
  { description: 'lunch', category: 'food', amount: 50 },
  { description: 'clothes', category: 'shopping', amount: 200 },
];

// ─── POST /api/expenses/parse ─────────────────────────────────────────────────
describe('POST /api/expenses/parse', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 400 when message is missing', async () => {
    const res = await request(app).post('/api/expenses/parse').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when message is an empty string', async () => {
    const res = await request(app).post('/api/expenses/parse').send({ message: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 200 with parsed expenses on valid message', async () => {
    parseExpenseMessage.mockResolvedValue(SAMPLE_EXPENSES);

    const res = await request(app)
      .post('/api/expenses/parse')
      .send({ message: 'I spent 50 on lunch and 200 on clothes' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('expenses');
    expect(res.body.expenses).toHaveLength(2);
    expect(res.body.expenses[0]).toMatchObject({ description: 'lunch', amount: 50 });
  });

  it('should return 500 when Gemini throws an error', async () => {
    parseExpenseMessage.mockRejectedValue(new Error('Gemini API error: quota exceeded'));

    const res = await request(app)
      .post('/api/expenses/parse')
      .send({ message: 'I spent 100 on food' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});
