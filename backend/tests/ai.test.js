const request = require('supertest');
const today = new Date().toISOString().split('T')[0];

// Set up mocks before importing app
const { mockDb, mockBatch, mockDocRef, mockQuerySnapshot } = require('./mocks');
const { parseExpenseMessage, generateBudgetInsight, generateChatReply } = require('../services/geminiService');

const app = require('../app');

const SAMPLE_EXPENSES = [
  { description: 'lunch', category: 'food', amount: 50 },
  { description: 'clothes', category: 'shopping', amount: 200 },
];

const FIRESTORE_DOCS = SAMPLE_EXPENSES.map((e, i) => ({
  id: `doc-${i}`,
  data: () => ({ ...e, date: today, createdAt: { toDate: () => new Date() } }),
}));

// ─── POST /api/ai/expense ─────────────────────────────────────────────────────
describe('POST /api/ai/expense', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 400 when message is missing', async () => {
    const res = await request(app).post('/api/ai/expense').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 200 with empty result when Gemini finds no expenses', async () => {
    parseExpenseMessage.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/ai/expense')
      .send({ message: 'I did nothing today' });

    expect(res.statusCode).toBe(200);
    expect(res.body.parsedExpenses).toEqual([]);
    expect(res.body.totalSpent).toBe(0);
  });

  it('should save expenses to Firestore and return 201 with totals', async () => {
    parseExpenseMessage.mockResolvedValue(SAMPLE_EXPENSES);

    const res = await request(app)
      .post('/api/ai/expense')
      .send({ message: 'Spent 50 on lunch and 200 on clothes' });

    expect(res.statusCode).toBe(201);
    expect(res.body.parsedExpenses).toHaveLength(2);
    expect(res.body.totalSpent).toBe(250);

    // Firestore batch should have been called
    expect(mockBatch.set).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('each saved expense should have required fields', async () => {
    parseExpenseMessage.mockResolvedValue(SAMPLE_EXPENSES);

    const res = await request(app)
      .post('/api/ai/expense')
      .send({ message: 'Spent 50 on lunch and 200 on clothes' });

    for (const expense of res.body.parsedExpenses) {
      expect(expense).toHaveProperty('id');
      expect(expense).toHaveProperty('description');
      expect(expense).toHaveProperty('category');
      expect(expense).toHaveProperty('amount');
      expect(expense).toHaveProperty('date');
      expect(expense).toHaveProperty('createdAt');
    }
  });

  it('should return 500 when Gemini throws', async () => {
    parseExpenseMessage.mockRejectedValue(new Error('Gemini API error'));

    const res = await request(app)
      .post('/api/ai/expense')
      .send({ message: 'bought groceries' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── POST /api/ai/insight ─────────────────────────────────────────────────────
describe('POST /api/ai/insight', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 400 when expenses array is missing', async () => {
    const res = await request(app)
      .post('/api/ai/insight')
      .send({ monthlyBudget: 5000 });
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when expenses array is empty', async () => {
    const res = await request(app)
      .post('/api/ai/insight')
      .send({ expenses: [], monthlyBudget: 5000 });
    expect(res.statusCode).toBe(400);
  });

  it('should return 400 when monthlyBudget is missing or zero', async () => {
    const res = await request(app)
      .post('/api/ai/insight')
      .send({ expenses: SAMPLE_EXPENSES, monthlyBudget: 0 });
    expect(res.statusCode).toBe(400);
  });

  it('should return 200 with insight, totalSpent and percentUsed', async () => {
    generateBudgetInsight.mockResolvedValue(
      'You have used 5% of your budget — great job keeping costs low!'
    );

    const res = await request(app)
      .post('/api/ai/insight')
      .send({ expenses: SAMPLE_EXPENSES, monthlyBudget: 5000 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('insight');
    expect(res.body.totalSpent).toBe(250);
    expect(res.body.percentUsed).toBe(5);
    expect(res.body.monthlyBudget).toBe(5000);
  });

  it('should return 500 when Gemini throws', async () => {
    generateBudgetInsight.mockRejectedValue(new Error('Gemini API error'));

    const res = await request(app)
      .post('/api/ai/insight')
      .send({ expenses: SAMPLE_EXPENSES, monthlyBudget: 5000 });

    expect(res.statusCode).toBe(500);
  });
});

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
describe('POST /api/ai/chat', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 400 when message is missing', async () => {
    const res = await request(app).post('/api/ai/chat').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 when message is empty string', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: '' });
    expect(res.statusCode).toBe(400);
  });

  it('should return 200 with a reply from Gemini when Firestore has no expenses', async () => {
    mockQuerySnapshot.docs = [];
    generateChatReply.mockResolvedValue("You haven't recorded any expenses this month yet.");

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'How much did I spend today?' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(typeof res.body.reply).toBe('string');
  });

  it('should pass expense context and budget to Gemini', async () => {
    mockQuerySnapshot.docs = FIRESTORE_DOCS;
    generateChatReply.mockResolvedValue('You spent ₱250 today.');

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'What did I spend today?', monthlyBudget: 5000 });

    expect(res.statusCode).toBe(200);
    expect(generateChatReply).toHaveBeenCalledWith(
      'What did I spend today?',
      expect.objectContaining({
        monthlyBudget: 5000,
        recentExpenses: expect.any(Array),
        todayTotal: expect.any(Number),
        monthlyTotal: expect.any(Number),
      })
    );
  });

  it('should return 500 when Gemini throws', async () => {
    mockQuerySnapshot.docs = [];
    generateChatReply.mockRejectedValue(new Error('Gemini API error'));

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'How much have I spent?' });

    expect(res.statusCode).toBe(500);
  });
});
