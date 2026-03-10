const express = require('express');
const router = express.Router();
const { parseExpenseMessage, generateBudgetInsight, generateChatReply, generateDailySuggestion, detectChatAction } = require('../services/geminiService');
const { db } = require('../firebase/firebaseAdmin');
const authenticate = require('../middleware/authenticate');

// All AI routes require a valid Firebase ID token
router.use(authenticate);

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

    // 2. Save each expense to the authenticated user's sub-collection
    const now = new Date();
    const batch = db.batch();
    const collectionRef = db.collection('users').doc(req.uid).collection('expenses');
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
    // ── Step 1: Detect if the user is requesting a data modification ──────────
    const { action, params } = await detectChatAction(message.trim());

    if (action === 'add_to_budget' || action === 'set_budget') {
      const budgetRef = db.collection('users').doc(req.uid).collection('budgets').doc('current');
      const snap = await budgetRef.get();
      const current = snap.exists ? snap.data() : {};
      const currentBudget = current.monthlyBudget ?? 0;
      const newBudget = action === 'add_to_budget'
        ? currentBudget + params.amount
        : params.amount;

      await budgetRef.set({ ...current, monthlyBudget: newBudget, createdAt: new Date() });

      const reply = action === 'add_to_budget'
        ? `Done! I added ₱${params.amount.toLocaleString()} to your budget. Your monthly budget is now ₱${newBudget.toLocaleString()}.`
        : `Done! Your monthly budget has been set to ₱${newBudget.toLocaleString()}.`;

      return res.status(200).json({
        reply,
        actionExecuted: { type: action, newMonthlyBudget: newBudget },
      });
    }

    if (action === 'set_savings_goal') {
      const budgetRef = db.collection('users').doc(req.uid).collection('budgets').doc('current');
      const snap = await budgetRef.get();
      const current = snap.exists ? snap.data() : {};

      await budgetRef.set({ ...current, savingsGoal: params.amount, createdAt: new Date() });

      return res.status(200).json({
        reply: `Done! Your savings goal has been set to ₱${params.amount.toLocaleString()}.`,
        actionExecuted: { type: action, newSavingsGoal: params.amount },
      });
    }

    if (action === 'add_expense') {
      const expenseRef = db.collection('users').doc(req.uid).collection('expenses').doc();
      const now = new Date();
      const expenseDoc = {
        description: params.description,
        category:    params.category,
        amount:      params.amount,
        date:        now.toISOString().split('T')[0],
        createdAt:   now,
      };
      await expenseRef.set(expenseDoc);

      return res.status(200).json({
        reply: `Done! I've recorded a ₱${params.amount.toLocaleString()} ${params.category} expense for "${params.description}".`,
        actionExecuted: { type: action, expense: { id: expenseRef.id, ...expenseDoc, createdAt: now.toISOString() } },
      });
    }

    // ── Step 2: No action detected — normal conversational reply ──────────────
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const snapshot = await db
      .collection('users').doc(req.uid).collection('expenses')
      .where('createdAt', '>=', firstOfMonth)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const recentExpenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.().toISOString() ?? null,
    }));

    const todayTotal = recentExpenses
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const monthlyTotal = recentExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const categoryTotals = recentExpenses.reduce((acc, e) => {
      const cat = e.category || 'other';
      acc[cat] = (acc[cat] || 0) + (e.amount || 0);
      return acc;
    }, {});

    const budget = typeof monthlyBudget === 'number' && monthlyBudget > 0 ? monthlyBudget : 0;
    const remainingBudget = budget > 0 ? budget - monthlyTotal : 0;

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
      .collection('users').doc(req.uid).collection('expenses')
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
