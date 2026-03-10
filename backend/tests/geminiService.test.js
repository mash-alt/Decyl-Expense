const { parseExpenseMessage, generateBudgetInsight, generateChatReply } = require('../services/geminiService');

// These tests verify the service module exports the correct interface.
// The actual Gemini API is NOT called — we test the real function logic
// with mocked GoogleGenerativeAI responses.

jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn();
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent,
      }),
    })),
    _mockGenerateContent: mockGenerateContent,
  };
});

const { _mockGenerateContent } = require('@google/generative-ai');

// ─── parseExpenseMessage ──────────────────────────────────────────────────────
describe('parseExpenseMessage()', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return a parsed array of expenses', async () => {
    const fakeJson = '[{"description":"lunch","category":"food","amount":50}]';
    _mockGenerateContent.mockResolvedValue({ response: { text: () => fakeJson } });

    const result = await parseExpenseMessage('I had lunch for 50');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toMatchObject({ description: 'lunch', category: 'food', amount: 50 });
  });

  it('should strip markdown code fences from Gemini response', async () => {
    const fakeJson =
      '```json\n[{"description":"coffee","category":"food","amount":20}]\n```';
    _mockGenerateContent.mockResolvedValue({ response: { text: () => fakeJson } });

    const result = await parseExpenseMessage('coffee for 20');
    expect(result[0].description).toBe('coffee');
  });

  it('should return empty array when Gemini returns []', async () => {
    _mockGenerateContent.mockResolvedValue({ response: { text: () => '[]' } });

    const result = await parseExpenseMessage('nothing today');
    expect(result).toEqual([]);
  });

  it('should filter out items missing required fields', async () => {
    const fakeJson =
      '[{"description":"lunch","category":"food","amount":50},{"bad":"data"}]';
    _mockGenerateContent.mockResolvedValue({ response: { text: () => fakeJson } });

    const result = await parseExpenseMessage('mixed data');
    expect(result).toHaveLength(1);
  });

  it('should throw a descriptive error when Gemini returns invalid JSON', async () => {
    _mockGenerateContent.mockResolvedValue({ response: { text: () => 'not valid json' } });

    await expect(parseExpenseMessage('broken')).rejects.toThrow(
      'Gemini returned an invalid JSON response'
    );
  });

  it('should throw when Gemini returns a non-array JSON value', async () => {
    _mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"key":"value"}' },
    });

    await expect(parseExpenseMessage('object')).rejects.toThrow(
      'Gemini response is not a JSON array'
    );
  });
});

// ─── generateBudgetInsight ────────────────────────────────────────────────────
describe('generateBudgetInsight()', () => {
  afterEach(() => jest.clearAllMocks());

  const expenses = [
    { description: 'lunch', category: 'food', amount: 150 },
    { description: 'shirt', category: 'shopping', amount: 500 },
  ];

  it('should return an insight string', async () => {
    _mockGenerateContent.mockResolvedValue({
      response: { text: () => 'You spent 13% of your budget — keep it up!' },
    });

    const result = await generateBudgetInsight(expenses, 5000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should throw when expenses array is empty', async () => {
    await expect(generateBudgetInsight([], 5000)).rejects.toThrow(
      'At least one expense is required'
    );
  });

  it('should throw when monthlyBudget is zero or negative', async () => {
    await expect(generateBudgetInsight(expenses, 0)).rejects.toThrow(
      'monthlyBudget must be a positive number'
    );
    await expect(generateBudgetInsight(expenses, -100)).rejects.toThrow(
      'monthlyBudget must be a positive number'
    );
  });

  it('should throw when Gemini returns empty text', async () => {
    _mockGenerateContent.mockResolvedValue({ response: { text: () => '' } });

    await expect(generateBudgetInsight(expenses, 5000)).rejects.toThrow(
      'Gemini returned an empty insight'
    );
  });
});

// ─── generateChatReply ────────────────────────────────────────────────────────
describe('generateChatReply()', () => {
  afterEach(() => jest.clearAllMocks());

  const context = {
    recentExpenses: [{ description: 'lunch', category: 'food', amount: 50, date: '2026-03-10' }],
    todayTotal: 50,
    monthlyTotal: 50,
    monthlyBudget: 5000,
    remainingBudget: 4950,
    categoryTotals: { food: 50 },
    today: '2026-03-10',
  };

  it('should return a reply string', async () => {
    _mockGenerateContent.mockResolvedValue({
      response: { text: () => 'You spent ₱50 today on food.' },
    });

    const result = await generateChatReply('How much did I spend?', context);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should throw when message is empty', async () => {
    await expect(generateChatReply('', context)).rejects.toThrow(
      'A valid message string is required'
    );
  });

  it('should throw when Gemini returns empty text', async () => {
    _mockGenerateContent.mockResolvedValue({ response: { text: () => '' } });

    await expect(generateChatReply('question', context)).rejects.toThrow(
      'Gemini returned an empty reply'
    );
  });

  it('should work with empty expense context', async () => {
    _mockGenerateContent.mockResolvedValue({
      response: { text: () => "You haven't recorded any expenses yet." },
    });

    const result = await generateChatReply('Any expenses?', {
      recentExpenses: [],
      todayTotal: 0,
      monthlyTotal: 0,
      monthlyBudget: 0,
      remainingBudget: 0,
      categoryTotals: {},
      today: '2026-03-10',
    });

    expect(result).toContain("haven't");
  });
});
