require('dotenv').config();
const http = require('http');

const BASE = 'http://localhost:3000';
let passed = 0;
let failed = 0;

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

function check(testName, condition, actual) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    console.log(`     Got:`, JSON.stringify(actual, null, 2));
    failed++;
  }
}

async function run() {
  console.log('\n========================================');
  console.log('  LIVE AI ENDPOINT TESTS');
  console.log('========================================\n');

  // ── 1. Health ────────────────────────────────────────────────────────────
  console.log('📋 GET /api/health');
  const health = await get('/api/health');
  check('returns 200', health.status === 200, health);
  check('has status field', health.body.status === 'server running', health.body);
  console.log('  Response:', health.body, '\n');

  // ── 2. POST /api/expenses/parse – validation ──────────────────────────────
  console.log('📋 POST /api/expenses/parse — validation');
  const noMsg = await post('/api/expenses/parse', {});
  check('returns 400 for missing message', noMsg.status === 400, noMsg.body);
  console.log('  Response:', noMsg.body, '\n');

  // ── 3. POST /api/expenses/parse – real AI call ───────────────────────────
  console.log('📋 POST /api/expenses/parse — AI parse');
  const parse = await post('/api/expenses/parse', {
    message: 'I spent 50 on lunch and 200 on groceries',
  });
  console.log('  Status:', parse.status);
  console.log('  Response:', JSON.stringify(parse.body, null, 2));
  if (parse.status === 200) {
    check('returns expenses array', Array.isArray(parse.body.expenses), parse.body);
    check('at least one expense found', parse.body.expenses.length > 0, parse.body);
    if (parse.body.expenses.length > 0) {
      const e = parse.body.expenses[0];
      check('expense has description', typeof e.description === 'string', e);
      check('expense has category', typeof e.category === 'string', e);
      check('expense has amount', typeof e.amount === 'number', e);
    }
  } else {
    check('AI parse succeeded', false, parse.body);
  }
  console.log();

  // ── 4. POST /api/ai/expense – save to Firestore ───────────────────────────
  console.log('📋 POST /api/ai/expense — parse + save');
  const aiExpense = await post('/api/ai/expense', {
    message: 'bought coffee for 80 and took a taxi for 120',
  });
  console.log('  Status:', aiExpense.status);
  console.log('  Response:', JSON.stringify(aiExpense.body, null, 2));
  if (aiExpense.status === 201) {
    check('has parsedExpenses array', Array.isArray(aiExpense.body.parsedExpenses), aiExpense.body);
    check('has totalSpent number', typeof aiExpense.body.totalSpent === 'number', aiExpense.body);
    check('totalSpent > 0', aiExpense.body.totalSpent > 0, aiExpense.body);
    if (aiExpense.body.parsedExpenses.length > 0) {
      const e = aiExpense.body.parsedExpenses[0];
      check('saved expense has id', typeof e.id === 'string', e);
      check('saved expense has date', typeof e.date === 'string', e);
      check('saved expense has createdAt', typeof e.createdAt === 'string', e);
    }
  } else {
    check('ai/expense succeeded', false, aiExpense.body);
  }
  console.log();

  // ── 5. POST /api/ai/insight ───────────────────────────────────────────────
  console.log('📋 POST /api/ai/insight — budget insight');
  const insight = await post('/api/ai/insight', {
    monthlyBudget: 5000,
    expenses: [
      { description: 'lunch', category: 'food', amount: 150 },
      { description: 'taxi', category: 'transport', amount: 200 },
      { description: 'shirt', category: 'shopping', amount: 900 },
    ],
  });
  console.log('  Status:', insight.status);
  console.log('  Response:', JSON.stringify(insight.body, null, 2));
  if (insight.status === 200) {
    check('has insight string', typeof insight.body.insight === 'string', insight.body);
    check('insight is not empty', insight.body.insight.length > 0, insight.body);
    check('has totalSpent', typeof insight.body.totalSpent === 'number', insight.body);
    check('has percentUsed', typeof insight.body.percentUsed === 'number', insight.body);
    check('totalSpent equals 1250', insight.body.totalSpent === 1250, insight.body);
  } else {
    check('ai/insight succeeded', false, insight.body);
  }
  console.log();

  // ── 6. POST /api/ai/chat ──────────────────────────────────────────────────
  console.log('📋 POST /api/ai/chat — conversational query');
  const chat = await post('/api/ai/chat', {
    message: 'How much have I spent this month?',
    monthlyBudget: 5000,
  });
  console.log('  Status:', chat.status);
  console.log('  Response:', JSON.stringify(chat.body, null, 2));
  if (chat.status === 200) {
    check('has reply string', typeof chat.body.reply === 'string', chat.body);
    check('reply is not empty', chat.body.reply.length > 0, chat.body);
  } else {
    check('ai/chat succeeded', false, chat.body);
  }
  console.log();

  // ── 7. Validation edge cases ──────────────────────────────────────────────
  console.log('📋 Validation edge cases');
  const emptyInsight = await post('/api/ai/insight', { expenses: [], monthlyBudget: 5000 });
  check('/ai/insight 400 for empty expenses', emptyInsight.status === 400, emptyInsight.body);

  const badBudget = await post('/api/ai/insight', {
    expenses: [{ description: 'lunch', category: 'food', amount: 50 }],
    monthlyBudget: 0,
  });
  check('/ai/insight 400 for zero budget', badBudget.status === 400, badBudget.body);

  const emptyChat = await post('/api/ai/chat', { message: '' });
  check('/ai/chat 400 for empty message', emptyChat.status === 400, emptyChat.body);
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('========================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
