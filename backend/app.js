require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Route imports
const healthRoute = require('./routes/health');
const expensesRoute = require('./routes/expenses');
const aiRoute = require('./routes/ai');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/health', healthRoute);
app.use('/api/expenses', expensesRoute);
app.use('/api/ai', aiRoute);

module.exports = app;
