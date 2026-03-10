const express = require('express');
const router = express.Router();
const { db } = require('../firebase/firebaseAdmin');
const authenticate = require('../middleware/authenticate');

/** Fixed document ID — one active budget doc per user. */
const BUDGET_DOC_ID = 'current';

// All budget routes require a valid Firebase ID token
router.use(authenticate);

// ─── GET /api/budgets ─────────────────────────────────────────────────────────
// Returns the authenticated user's current budget settings, or null if none set.
router.get('/', async (req, res) => {
  try {
    const docRef = db
      .collection('users').doc(req.uid)
      .collection('budgets').doc(BUDGET_DOC_ID);

    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(200).json({ budget: null });
    }

    const data = snap.data();
    res.status(200).json({
      budget: {
        id:               snap.id,
        monthlyBudget:    data.monthlyBudget    ?? 0,
        savingsGoal:      data.savingsGoal      ?? 0,
        categoryLimits:   data.categoryLimits   ?? {},
        customCategories: data.customCategories ?? [],
        createdAt:        data.createdAt?.toDate?.().toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('[budgets/GET] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── POST /api/budgets/save ───────────────────────────────────────────────────
// Creates or fully replaces the authenticated user's budget document.
router.post('/save', async (req, res) => {
  const {
    monthlyBudget,
    savingsGoal      = 0,
    categoryLimits   = {},
    customCategories = [],
  } = req.body;

  if (typeof monthlyBudget !== 'number' || monthlyBudget <= 0) {
    return res.status(400).json({ error: '"monthlyBudget" must be a positive number.' });
  }

  try {
    const docRef = db
      .collection('users').doc(req.uid)
      .collection('budgets').doc(BUDGET_DOC_ID);

    const now = new Date();
    const payload = {
      monthlyBudget,
      savingsGoal,
      categoryLimits,
      customCategories,
      createdAt: now,
    };

    await docRef.set(payload);

    res.status(200).json({
      budget: {
        id: BUDGET_DOC_ID,
        ...payload,
        createdAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[budgets/save] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
