const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite-preview' });

/**
 * Sends a natural language message to Gemini and extracts structured expense data.
 *
 * @param {string} message - Natural language description of expenses.
 * @returns {Promise<Array>} - Array of parsed expense objects.
 *
 * Example return:
 * [
 *   { description: "lunch", category: "food", amount: 50 },
 *   { description: "clothes", category: "shopping", amount: 200 }
 * ]
 */
async function parseExpenseMessage(message) {
  const prompt = `
You are an expense tracking assistant. Extract all expenses from the user's message and return them as a JSON array.

Each expense object must have exactly these fields:
- "description": short label for the expense (string)
- "category": one of "food", "transport", "shopping", "utilities", "health", "entertainment", "other" (string)
- "amount": numeric value only, no currency symbols (number)

Rules:
- Return ONLY a raw JSON array. No markdown, no code fences, no extra text.
- If no expenses are found, return an empty array: []
- Infer the category from context as best you can.

User message: "${message}"
`;

  let rawText = '';

  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps the response anyway
    rawText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(rawText);

    if (!Array.isArray(parsed)) {
      throw new Error('Gemini response is not a JSON array.');
    }

    // Validate and sanitize each item
    const expenses = parsed
      .filter(
        (item) =>
          item &&
          typeof item.description === 'string' &&
          typeof item.category === 'string' &&
          typeof item.amount === 'number'
      )
      .map((item) => ({
        description: item.description.trim(),
        category: item.category.trim().toLowerCase(),
        amount: item.amount,
      }));

    return expenses;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('[geminiService] Failed to parse Gemini JSON response:', rawText);
      throw new Error('Gemini returned an invalid JSON response. Please try again.');
    }
    console.error('[geminiService] Error calling Gemini API:', error.message);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Generates a short, actionable budget insight based on recent expenses.
 *
 * @param {Array}  expenses       - Array of expense objects { description, category, amount }.
 * @param {number} monthlyBudget  - The user's total monthly budget.
 * @returns {Promise<string>}     - A short financial suggestion from Gemini.
 *
 * Example return:
 * "You have spent 65% of your monthly budget. Consider reducing food delivery expenses this week."
 */
async function generateBudgetInsight(expenses, monthlyBudget) {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    throw new Error('At least one expense is required to generate a budget insight.');
  }

  if (typeof monthlyBudget !== 'number' || monthlyBudget <= 0) {
    throw new Error('monthlyBudget must be a positive number.');
  }

  const totalSpent = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const percentUsed = ((totalSpent / monthlyBudget) * 100).toFixed(1);

  // Build a concise expense breakdown for the prompt
  const categoryTotals = expenses.reduce((acc, e) => {
    const cat = e.category || 'other';
    acc[cat] = (acc[cat] || 0) + (e.amount || 0);
    return acc;
  }, {});

  const breakdown = Object.entries(categoryTotals)
    .map(([cat, total]) => `  - ${cat}: ${total}`)
    .join('\n');

  const prompt = `
You are a personal finance assistant. Based on the expense data below, write ONE short, specific, and actionable financial suggestion for the user.

Budget summary:
- Monthly budget: ${monthlyBudget}
- Total spent so far: ${totalSpent} (${percentUsed}% of budget)
- Spending breakdown by category:
${breakdown}

Rules:
- Reply with a SINGLE sentence or two sentences maximum.
- Be specific — reference actual categories or percentages from the data.
- Be encouraging but honest.
- Do NOT use bullet points, headers, or markdown formatting.
- Do NOT include any preamble like "Sure!" or "Here is your insight:".
`;

  try {
    const result = await model.generateContent(prompt);
    const insight = result.response.text().trim();

    if (!insight) {
      throw new Error('Gemini returned an empty insight.');
    }

    return insight;
  } catch (error) {
    console.error('[geminiService] Error generating budget insight:', error.message);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Generates a conversational reply to a user's finance question,
 * grounded in their real expense data and budget context.
 *
 * @param {string} message        - The user's question or message.
 * @param {Object} context        - Structured financial context.
 * @param {Array}  context.recentExpenses   - Last 30 days of expenses.
 * @param {number} context.todayTotal       - Total spent today.
 * @param {number} context.monthlyTotal     - Total spent this month.
 * @param {number} context.monthlyBudget    - User's monthly budget (0 = not set).
 * @param {number} context.remainingBudget  - Budget minus monthly total.
 * @param {Object} context.categoryTotals   - Spending per category this month.
 * @param {string} context.today            - Today's date string (YYYY-MM-DD).
 * @returns {Promise<string>} - Gemini's conversational reply.
 */
async function generateChatReply(message, context) {
  if (!message || typeof message !== 'string') {
    throw new Error('A valid message string is required.');
  }

  const {
    recentExpenses = [],
    todayTotal = 0,
    monthlyTotal = 0,
    monthlyBudget = 0,
    remainingBudget = 0,
    categoryTotals = {},
    today = new Date().toISOString().split('T')[0],
  } = context;

  const budgetLine =
    monthlyBudget > 0
      ? `Monthly budget: ${monthlyBudget} | Remaining: ${remainingBudget} (${(100 - (monthlyTotal / monthlyBudget) * 100).toFixed(1)}% left)`
      : 'Monthly budget: not set';

  const categoryBreakdown =
    Object.keys(categoryTotals).length > 0
      ? Object.entries(categoryTotals)
          .map(([cat, total]) => `  - ${cat}: ${total}`)
          .join('\n')
      : '  (no expenses recorded this month)';

  const recentList =
    recentExpenses.length > 0
      ? recentExpenses
          .slice(0, 10)
          .map((e) => `  [${e.date}] ${e.description} (${e.category}): ${e.amount}`)
          .join('\n')
      : '  (no recent expenses)';

  const prompt = `
You are a friendly and concise personal finance assistant for an expense tracker app.
Answer the user's question using ONLY the financial data provided below.

--- Financial Context (Today: ${today}) ---
Today's spending : ${todayTotal}
This month total : ${monthlyTotal}
${budgetLine}

Spending by category this month:
${categoryBreakdown}

Last 10 expenses:
${recentList}
--- End of Context ---

User question: "${message}"

Rules:
- Answer conversationally in 1–3 sentences.
- Use the ₱ symbol when referring to amounts.
- Be specific — use real numbers from the context.
- If the data doesn't contain enough information to answer, say so honestly.
- Do NOT use bullet points, markdown, or headers in your reply.
- Do NOT include any preamble like "Sure!" or "Of course!".
`;

  try {
    const result = await model.generateContent(prompt);
    const reply = result.response.text().trim();

    if (!reply) {
      throw new Error('Gemini returned an empty reply.');
    }

    return reply;
  } catch (error) {
    console.error('[geminiService] Error generating chat reply:', error.message);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

/**
 * Generates a proactive daily financial suggestion based on today's
 * spending and this month's totals — no user prompt needed.
 *
 * @param {Object} context
 * @param {number} context.todayTotal        - Total spent today.
 * @param {Array}  context.todayExpenses     - Today's expense records.
 * @param {number} context.monthlyTotal      - Total spent this month.
 * @param {number} context.monthlyBudget     - Monthly budget (0 = not set).
 * @param {number} context.remainingBudget   - Budget minus monthly total.
 * @param {Object} context.categoryTotals    - Per-category totals this month.
 * @param {string} context.today             - Today's date (YYYY-MM-DD).
 * @returns {Promise<string>} - A short proactive suggestion.
 */
async function generateDailySuggestion(context) {
  const {
    todayTotal = 0,
    todayExpenses = [],
    monthlyTotal = 0,
    monthlyBudget = 0,
    remainingBudget = 0,
    categoryTotals = {},
    today = new Date().toISOString().split('T')[0],
  } = context;

  const budgetLine =
    monthlyBudget > 0
      ? `Monthly budget: ${monthlyBudget} | Spent: ${monthlyTotal} | Remaining: ${remainingBudget} (${((monthlyTotal / monthlyBudget) * 100).toFixed(1)}% used)`
      : 'Monthly budget: not set';

  const todayList =
    todayExpenses.length > 0
      ? todayExpenses
          .map((e) => `  - ${e.description} (${e.category}): ${e.amount}`)
          .join('\n')
      : '  (no expenses recorded today)';

  const categoryBreakdown =
    Object.keys(categoryTotals).length > 0
      ? Object.entries(categoryTotals)
          .map(([cat, total]) => `  - ${cat}: ${total}`)
          .join('\n')
      : '  (no expenses recorded this month)';

  const prompt = `
You are a proactive personal finance assistant for an expense tracker app.
Based on the user's spending data below, write a single helpful and encouraging daily financial suggestion.

--- Spending Data (Today: ${today}) ---
Today's total   : ${todayTotal}
Today's expenses:
${todayList}

${budgetLine}

This month by category:
${categoryBreakdown}
--- End of Data ---

Rules:
- Write ONE suggestion in 1-2 sentences maximum.
- Be specific — reference actual amounts, categories, or percentages.
- Be encouraging and actionable, not just observational.
- Use the ₱ symbol for amounts.
- Do NOT use bullet points, markdown, or headers.
- Do NOT include preamble like "Sure!" or "Here is your suggestion:".
- If no expenses exist today, give a motivational tip to start tracking.
`;

  try {
    const result = await model.generateContent(prompt);
    const suggestion = result.response.text().trim();

    if (!suggestion) {
      throw new Error('Gemini returned an empty suggestion.');
    }

    return suggestion;
  } catch (error) {
    console.error('[geminiService] Error generating daily suggestion:', error.message);
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

module.exports = { parseExpenseMessage, generateBudgetInsight, generateChatReply, generateDailySuggestion };