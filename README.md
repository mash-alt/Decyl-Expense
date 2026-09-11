# Decyl Expense

**Decyl Expense** is a modern expense tracking and budgeting application designed to help users understand, manage, and improve their spending habits.

The app combines traditional expense tracking with an AI-powered financial assistant. Users can set their monthly budget and savings goals, record expenses manually, view spending statistics, and receive personalized budgeting suggestions.

## How It Works

### 💰 Budget Management

Users set their:

* Monthly budget
* Savings goal
* Spending categories
* Category spending limits

The application continuously compares the user's spending against their budget and category limits.

### 🧾 Expense Tracking

Expenses can be added manually through a simple interface similar to a Notion-style database.

Each expense contains:

* Description
* Amount
* Category
* Date

Expenses are stored in Firebase and automatically reflected throughout the application.

### 📊 Financial Dashboard

The dashboard provides an overview of the user's current financial situation, including:

* Total amount spent
* Remaining budget
* Today's spending
* Category spending
* Recent expenses
* Budget progress

### 📈 Insights & Statistics

The app analyzes recorded expenses to visualize spending behavior through charts and statistics.

Users can identify patterns such as:

* Which categories they spend the most on
* Weekly and monthly spending trends
* Progress toward their budget
* Areas where they may be overspending

### 🤖 AI Financial Assistant

The AI assistant allows users to interact with their finances using natural language.

For example:

> "I spent ₱50 on lunch and ₱200 on clothes."

The AI can interpret the message, identify the individual expenses, record them, and update the user's financial balance.

Users can also ask questions such as:

> "How much have I spent today?"

or

> "Am I spending too much on food?"

The assistant uses the user's expense history and budget information to provide contextual responses and recommendations.

### 💡 Personalized Suggestions

Based on the user's budget and spending behavior, the application can provide suggestions such as:

* Recommended daily spending limits
* Ways to reduce spending
* Meal suggestions based on the remaining budget
* Warnings when approaching category limits
* Budgeting recommendations

## Technology

* **React** — Frontend
* **Express.js** — Backend API
* **Firebase Firestore** — Database
* **Firebase Hosting** — Frontend hosting
* **Gemini AI** — AI financial assistant

## Goal

Decyl Expense aims to make personal budgeting less tedious by turning expense tracking into an interactive experience where users can **record, understand, and improve their financial habits**.
