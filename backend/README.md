# Decyl Expense Tracker — Backend API

A Node.js/Express backend that uses **Google Gemini AI** to parse natural language expense messages, store them in **Firebase Firestore**, and provide intelligent financial insights and conversational responses.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
  - [Health](#get-apihealth)
  - [Parse Expenses](#post-apiexpensesparse)
  - [AI — Log Expense](#post-apiaiexpense)
  - [AI — Budget Insight](#post-apiaiinsight)
  - [AI — Chat](#post-aiaichat)
  - [AI — Daily Suggestion](#get-apiaIdaily-suggestion)
- [Error Responses](#error-responses)
- [Firestore Data Model](#firestore-data-model)
- [Running Tests](#running-tests)
- [Scripts](#scripts)

---

## Tech Stack

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.18.2 | HTTP server and routing |
| `cors` | ^2.8.5 | Cross-origin request handling |
| `dotenv` | ^16.4.5 | Environment variable loading |
| `@google/generative-ai` | ^0.21.0 | Gemini AI integration |
| `firebase-admin` | ^12.0.0 | Firestore database access |
| `nodemon` | ^3.1.0 | Dev auto-restart |
| `jest` | — | Unit testing |
| `supertest` | — | HTTP integration testing |

**AI Model:** `gemini-3.1-flash-lite-preview`

---

## Project Structure

```
backend/
├── app.js                  # Express app (no server binding — used by tests)
├── server.js               # Entry point — binds app to port
├── .env                    # Environment variables (never commit this)
├── .gitignore
├── package.json
│
├── routes/
│   ├── health.js           # GET /api/health
│   ├── expenses.js         # POST /api/expenses/parse
│   └── ai.js               # POST /api/ai/expense|insight|chat
│
├── services/
│   └── geminiService.js    # All Gemini AI functions
│
├── firebase/
│   └── firebaseAdmin.js    # Firebase Admin SDK init + Firestore export
│
└── tests/
    ├── mocks.js             # Shared Jest mocks (Firebase + Gemini)
    ├── health.test.js       # Health route unit tests
    ├── expenses.test.js     # Expense parse route unit tests
    ├── ai.test.js           # AI routes unit tests (35 cases)
    ├── geminiService.test.js# Gemini service unit tests
    └── live.test.js         # Live integration tests (requires running server)
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A [Google AI Studio](https://aistudio.google.com) API key
- A Firebase project with Firestore enabled and a service account key

### Installation

```bash
cd backend
npm install
```

### Run in development

```bash
npm run dev
```

Server starts at `http://localhost:3000`

---

## Environment Variables

Create a `.env` file in the `backend/` folder:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase — Option 1: path to service account JSON file
# GOOGLE_APPLICATION_CREDENTIALS=./firebase/serviceAccountKey.json

# Firebase — Option 2: individual credentials (recommended for deployment)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY\n-----END PRIVATE KEY-----\n"
```

> ⚠️ Never commit `.env` or `firebase/serviceAccountKey.json` to version control.

---

## API Reference

### `GET /api/health`

Checks that the server is running.

**Response `200`**
```json
{ "status": "server running" }
```

---

### `POST /api/expenses/parse`

Parses a natural language message into structured expense objects using Gemini. **Does not save to Firestore.**

**Request body**
```json
{ "message": "I spent 50 on lunch and 200 on groceries" }
```

**Response `200`**
```json
{
  "expenses": [
    { "description": "lunch",     "category": "food", "amount": 50  },
    { "description": "groceries", "category": "food", "amount": 200 }
  ]
}
```

---

### `POST /api/ai/expense`

Parses a natural language message **and saves each expense to Firestore**.

**Request body**
```json
{ "message": "bought coffee for 80 and took a taxi for 120" }
```

**Response `201`**
```json
{
  "parsedExpenses": [
    {
      "id": "Cv64PvObm813UKavQsMP",
      "description": "coffee",
      "category": "food",
      "amount": 80,
      "date": "2026-03-10",
      "createdAt": "2026-03-10T09:12:11.557Z"
    },
    {
      "id": "rDTRhFeJaOr7TeLBmmtm",
      "description": "taxi",
      "category": "transport",
      "amount": 120,
      "date": "2026-03-10",
      "createdAt": "2026-03-10T09:12:11.557Z"
    }
  ],
  "totalSpent": 200
}
```

**Response `200` — no expenses detected**
```json
{
  "parsedExpenses": [],
  "totalSpent": 0,
  "message": "No expenses could be detected from the provided message."
}
```

---

### `POST /api/ai/insight`

Generates a short, actionable budget insight based on a provided expense list and monthly budget. **Does not read from Firestore** — expenses are passed directly in the request.

**Request body**
```json
{
  "monthlyBudget": 5000,
  "expenses": [
    { "description": "lunch",  "category": "food",      "amount": 150 },
    { "description": "taxi",   "category": "transport", "amount": 200 },
    { "description": "shirt",  "category": "shopping",  "amount": 900 }
  ]
}
```

**Response `200`**
```json
{
  "insight": "You've spent 25% of your monthly budget, with shopping accounting for 72% of your expenses — consider setting a clothing limit for the rest of the month.",
  "totalSpent": 1250,
  "percentUsed": 25.0,
  "monthlyBudget": 5000
}
```

---

### `POST /api/ai/chat`

Answers a free-form financial question using the user's **real Firestore expense data** as context. Automatically fetches this month's expenses before querying Gemini.

**Request body**
```json
{
  "message": "How much have I spent this month?",
  "monthlyBudget": 5000
}
```

> `monthlyBudget` is optional. If omitted or `0`, Gemini will answer without budget context.

**Response `200`**
```json
{
  "reply": "You have spent ₱200 so far this month, leaving you with ₱4,800 of your ₱5,000 budget."
}
```

**Context Gemini receives:**
- Total spent today
- Total spent this month
- Remaining budget
- Per-category spending breakdown
- Last 10 expense records

---

### `GET /api/ai/daily-suggestion`

Proactively fetches today's and this month's expenses from Firestore and returns a single actionable financial suggestion — no request body needed.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `monthlyBudget` | number | No | Used to calculate remaining budget and % used |

**Example request**
```
GET /api/ai/daily-suggestion?monthlyBudget=5000
```

**Response `200`**
```json
{
  "suggestion": "You've spent ₱450 today — 60% on food — consider cooking at home tonight to stay within your daily average.",
  "todayTotal": 450,
  "monthlyTotal": 3200,
  "monthlyBudget": 5000,
  "remainingBudget": 1800,
  "percentOfBudgetUsed": 64.0
}
```

**Response `200` — no budget provided**
```json
{
  "suggestion": "Great start — you've logged ₱450 today. Keep tracking every expense to build a clear picture of your spending habits.",
  "todayTotal": 450,
  "monthlyTotal": 3200
}
```

**Response `200` — no expenses today**
```json
{
  "suggestion": "You haven't logged any expenses yet today — start tracking now to stay on top of your finances!",
  "todayTotal": 0,
  "monthlyTotal": 0
}
```

---

## Error Responses

All endpoints return errors in this shape:

```json
{ "error": "A non-empty \"message\" field is required." }
```

| Status | Meaning |
|---|---|
| `400` | Validation error — missing or invalid request fields |
| `500` | Server error — Gemini API failure or Firestore error |

---

## Firestore Data Model

### Collection: `expenses`

| Field | Type | Example |
|---|---|---|
| `description` | `string` | `"coffee"` |
| `category` | `string` | `"food"` |
| `amount` | `number` | `80` |
| `date` | `string` | `"2026-03-10"` |
| `createdAt` | `Timestamp` | Firestore server timestamp |

**Valid categories:** `food` · `transport` · `shopping` · `utilities` · `health` · `entertainment` · `other`

---

## Running Tests

### Unit tests (no server required)

```bash
npm test
```

Runs 35 test cases across all routes and service functions with mocked Firebase and Gemini.

```
Test Suites: 4 passed, 4 total
Tests:       35 passed, 35 total
```

### Live integration tests (server must be running)

```bash
# Terminal 1
npm run dev

# Terminal 2
node tests/live.test.js
```

Runs 24 live checks against real Gemini and Firestore — validates actual AI response shapes and Firestore writes.

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start server in production mode |
| `npm run dev` | Start server with nodemon (auto-restart) |
| `npm test` | Run Jest unit test suite |
| `node tests/live.test.js` | Run live AI integration tests |
