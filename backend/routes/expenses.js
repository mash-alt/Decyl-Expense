const express = require('express');
const router = express.Router();
const { parseExpenseMessage } = require('../services/geminiService');

// POST /api/expenses/parse
router.post('/parse', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'A non-empty "message" field is required.' });
  }

  try {
    const expenses = await parseExpenseMessage(message.trim());
    res.status(200).json({ expenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
