const express = require('express');
const router = express.Router();
const { parseExpenseMessage, generateBudgetInsight, generateChatReply, generateDailySuggestion } = require('../services/geminiService');
const { db } = require('../firebase/firebaseAdmin');

// POST /api/ai/expense
router.post('/expense', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'A non-empty "message" field is required.' });
  }

  try {
    // 1. Parse natural language into structured expenses via Gemini
    const parsedExpenses = await parseExpenseMessage(message.trim());

    if (parsedExpenses.length === 0) {
      return res.status(200).json({
        parsedExpenses: [],
        totalSpent: 0,
        message: 'No expenses could be detected from the provided message.',
      });
    }

    // 2. Save each expense to Firestore
    const now = new Date();
    const batch = db.batch();
    const collectionRef = db.collection('expenses');
    const savedExpenses = [];

    for (const expense of parsedExpenses) {
      const docRef = collectionRef.doc();
      const expenseDoc = {
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        date: now.toISOString().split('T')[0],   // e.g. "2026-03-10"
        createdAt: now,
      };
      batch.set(docRef, expenseDoc);
      savedExpenses.push({ id: docRef.id, ...expenseDoc, createdAt: now.toISOString() });
    }

    await batch.commit();

    // 3. Calculate total spent
    const totalSpent = parsedExpenses.reduce((sum, e) => sum + e.amount, 0);

    res.status(201).json({ parsedExpenses: savedExpenses, totalSpent });
  } catch (error) {
    console.error('[ai/expense] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/insight
router.post('/insight', async (req, res) => {
  const { expenses, monthlyBudget } = req.body;

  if (!Array.isArray(expenses) || expenses.length === 0) {
    return res.status(400).json({ error: '"expenses" must be a non-empty array.' });
  }

  if (typeof monthlyBudget !== 'number' || monthlyBudget <= 0) {
    return res.status(400).json({ error: '"monthlyBudget" must be a positive number.' });
  }

  try {
    const insight = await generateBudgetInsight(expenses, monthlyBudget);
    const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const percentUsed = parseFloat(((totalSpent / monthlyBudget) * 100).toFixed(1));

    res.status(200).json({ insight, totalSpent, percentUsed, monthlyBudget });
  } catch (error) {
    console.error('[ai/insight] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  const { message, monthlyBudget = 0 } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'A non-empty "message" field is required.' });
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    // 1. Fetch expenses from this month ordered by date descending
    const snapshot = await db
      .collection('expenses')
      .where('createdAt', '>=', firstOfMonth)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const recentExpenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() ?? null,
    }));

    // 2. Compute today's total
    const todayTotal = recentExpenses
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // 3. Compute monthly total and category breakdown
    const monthlyTotal = recentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const categoryTotals = recentExpenses.reduce((acc, e) => {
      const cat = e.category || 'other';
      acc[cat] = (acc[cat] || 0) + (e.amount || 0);
      return acc;
    }, {});

    // 4. Remaining budget (0 if budget not provided)
    const budget = typeof monthlyBudget === 'number' && monthlyBudget > 0 ? monthlyBudget : 0;
    const remainingBudget = budget > 0 ? budget - monthlyTotal : 0;

    // 5. Ask Gemini
    const reply = await generateChatReply(message.trim(), {
      recentExpenses,
      todayTotal,
      monthlyTotal,
      monthlyBudget: budget,
      remainingBudget,
      categoryTotals,
      today,
    });

    res.status(200).json({ reply });
  } catch (error) {
    console.error('[ai/chat] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/daily-suggestion
router.get('/daily-suggestion', async (req, res) => {
  const monthlyBudget = parseFloat(req.query.monthlyBudget) || 0;

  try {
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    // Fetch all expenses from this month
    const snapshot = await db
      .collection('expenses')
      .where('createdAt', '>=', firstOfMonth)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const monthlyExpenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() ?? null,
    }));

    // Split into today vs rest of month
    const todayExpenses = monthlyExpenses.filter((e) => e.date === today);
    const todayTotal = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const monthlyTotal = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const categoryTotals = monthlyExpenses.reduce((acc, e) => {
      const cat = e.category || 'other';
      acc[cat] = (acc[cat] || 0) + (e.amount || 0);
      return acc;
    }, {});

    const budget = monthlyBudget > 0 ? monthlyBudget : 0;
    const remainingBudget = budget > 0 ? budget - monthlyTotal : 0;
    const percentOfBudgetUsed = budget > 0
      ? parseFloat(((monthlyTotal / budget) * 100).toFixed(1))
      : null;

    const suggestion = await generateDailySuggestion({
      todayTotal,
      todayExpenses,
      monthlyTotal,
      monthlyBudget: budget,
      remainingBudget,
      categoryTotals,
      today,
    });

    res.status(200).json({
      suggestion,
      todayTotal,
      monthlyTotal,
      ...(budget > 0 && { monthlyBudget: budget, remainingBudget, percentOfBudgetUsed }),
    });
  } catch (error) {
    console.error('[ai/daily-suggestion] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
