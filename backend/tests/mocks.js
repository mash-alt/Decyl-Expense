// Shared mock setup for Firebase Admin and Gemini — loaded before any test
// Jest automatically hoists jest.mock() calls, so this file is used via
// jest.config's setupFiles or required manually in each test suite.

// ─── Firebase Admin mock ──────────────────────────────────────────────────────
const mockBatch = {
  set: jest.fn(),
  commit: jest.fn().mockResolvedValue({}),
};

const mockDocRef = { id: 'mock-doc-id' };

const mockQuerySnapshot = {
  docs: [],
};

const mockCollection = jest.fn().mockReturnValue({
  doc: jest.fn().mockReturnValue(mockDocRef),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue(mockQuerySnapshot),
  add: jest.fn().mockResolvedValue(mockDocRef),
});

const mockDb = {
  collection: mockCollection,
  batch: jest.fn().mockReturnValue(mockBatch),
};

jest.mock('../firebase/firebaseAdmin', () => ({
  admin: {},
  db: mockDb,
}));

// ─── Gemini service mock ──────────────────────────────────────────────────────
jest.mock('../services/geminiService', () => ({
  parseExpenseMessage: jest.fn(),
  generateBudgetInsight: jest.fn(),
  generateChatReply: jest.fn(),
}));

module.exports = { mockDb, mockBatch, mockDocRef, mockQuerySnapshot, mockCollection };
