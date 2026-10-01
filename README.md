# 🏦 Banking System Simulation (Horizon SimBank)

> **⚠️ EDUCATIONAL PORTFOLIO SIMULATION ONLY**  
> This software is strictly an educational engineering portfolio project simulating core banking workflows. It does **not** connect to real financial institutions, credit networks, or payment processors, and handles **no actual currency or real monetary assets**.

A full-stack banking ledger engine engineered with **React (Vite)**, **Node.js (Express)**, and persistent **MySQL storage**, featuring **JWT authentication**, **Role-Based Access Control (RBAC)**, **ACID transaction guarantees**, **pessimistic row-locking concurrency defense**, and **administrative lifecycle state machines**.

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                 Vercel Frontend (React + Vite)              │
│   • AuthContext (Session Hydration)   • Role-Based Guard    │
│   • Customer Portal (Modals, Ledger)  • Admin Center (FSM)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON (JWT Bearer)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Render Backend (Node.js + Express)          │
│   • CORS Policy Whitelist            • Body Parsers         │
│   • authenticateToken Middleware     • authorizeRoles Guard │
│   • Account & Transaction Services   • Admin FSM Controller │
└──────────────────────────────┬──────────────────────────────┘
                               │ MySQL Pool (mysql2/promise)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Persistent Storage (MySQL Engine)           │
│   • users        (BCrypt, Role ENUM, Username/Email Index)  │
│   • accounts     (DECIMAL(15,2), Negative Check, Status)    │
│   • transactions (Immutable Ledger, Reference IDs, UUIDs)   │
│   • audit_logs   (Administrative Compliance Audit Trail)    │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Engineering & Interview Highlights

### 1. ACID Concurrency & Race Condition Defense
- **The Challenge:** Concurrent withdrawal or transfer requests can cause Time-of-Check to Time-of-Use (TOCTOU) race conditions, leading to double-spending or negative account balances.
- **The Solution:** Wrapped mutations in explicit database transactions with pessimistic row-level locking via `SELECT ... FOR UPDATE`.
- **Verified via automated test:** Dispatched 5 concurrent \$400 withdrawals against a \$1,000 balance using `Promise.all`. Exactly 2 succeeded and 3 were rejected with `400 Insufficient Funds`, keeping the balance at exactly \$200.00.

### 2. Deadlock-Free Inter-Account Transfers
- **The Challenge:** If User A transfers money to User B while User B simultaneously transfers money to User A, standard row-locking causes a cyclic wait deadlock.
- **The Solution:** Implemented deterministic lock acquisition hierarchy: regardless of who sends or receives, accounts are locked in strictly ascending numerical order of Primary Key ID (`ORDER BY id ASC FOR UPDATE`).

### 3. Role-Based Access Control & Privilege Escalation Prevention
- **The Challenge:** Attackers can inject `{ role: 'admin' }` into public registration payloads.
- **The Solution:** The registration controller strictly discards any client-supplied role and hardcodes `role = 'customer'`. Admin accounts can only be seeded securely or provisioned internally.

### 4. Account Lifecycle Finite State Machine (FSM)
- `ACTIVE` ⇄ `FROZEN`: Accounts can be frozen during fraud investigations, instantly blocking withdrawals, deposits, and transfers.
- `CLOSED` (Terminal Sink): Accounts can only be permanently closed if their balance has been liquidated to strictly **\$0.00**. Closed accounts can never be modified or reopened.

### 5. Immutable Double-Entry Ledger Reconciliation
- Balances are not just updated in place; every financial event appends an immutable entry to `transactions`. Our automated verification test reconstructs account balances from historical ledger events to prove 100% mathematical reconciliation.

---

## 🔑 Demo Credentials

| Role | Username / Identifier | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@12345` | Account Provisioning, Freeze/Unfreeze, Close, Audit Logs |
| **Customer 1** | `john_doe` | `Customer@12345` | Checking (`ACC-1001`), Savings (`ACC-1002`), Transfers |
| **Customer 2** | `jane_smith` | `Customer@12345` | Checking (`ACC-2001`), Recipient testing |

> *Tip: The Login page includes **"Demo Quick-Fill"** buttons to populate these credentials instantly during live interviews.*

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v18+)
- MySQL Server (running locally on port 3306)

### 1. Database Initialization
```bash
cd backend
npm install
npm run init-db
```
*Creates the `banking_simulation` database, runs `schema.sql` constraints, and seeds demo accounts.*

### 2. Run Backend Server
```bash
npm run dev
```
*API will start on `http://localhost:5001`.*

### 3. Run Automated Verification Test Suites
In a separate terminal inside `backend/`:
```bash
# Run all tests (Phases 2, 3, 4, and E2E Concurrency)
npm test

# Or run individual verification suites:
npm run test:phase2   # JWT Auth & Role Enforcement
npm run test:phase3   # ACID Deposits, Withdrawals & Transfers
npm run test:phase4   # Admin FSM, Freeze & Closure Safeguards
npm run test:e2e      # Concurrency, Deadlocks & Ledger Reconciliation
```

### 4. Run Frontend Application
```bash
cd ../frontend
npm install
npm run dev
```
*Visit `http://localhost:5173` in your browser.*

---

## 🌐 Production Deployment Guide

### A. Deploy Database (Remote MySQL)
You can provision a managed MySQL instance on services like **Aiven**, **PlanetScale**, **TiDB Cloud**, or **Railway**.
1. Copy your database connection credentials (`host`, `port`, `user`, `password`, `database`).
2. Run `npm run init-db` pointing to your remote database URL.

### B. Deploy REST API (Render)
1. Fork or push this repository to GitHub.
2. Log into [Render](https://render.com) and click **New > Web Service**.
3. Point to the repository with **Root Directory** set to `backend`.
4. Configure:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Under **Environment Variables**, provide:
   - `NODE_ENV=production`
   - `PORT=5001`
   - `DB_HOST=<your-remote-db-host>`
   - `DB_PORT=3306`
   - `DB_USER=<your-db-user>`
   - `DB_PASSWORD=<your-db-password>`
   - `DB_NAME=banking_simulation`
   - `JWT_SECRET=<secure-random-32-byte-string>`
   - `CLIENT_URL=https://<your-frontend>.vercel.app`

### C. Deploy Frontend (Vercel)
1. Log into [Vercel](https://vercel.com) and click **Add New > Project**.
2. Select your repository and set the **Root Directory** to `frontend`.
3. Framework Preset: **Vite**.
4. In **Environment Variables**, add:
   - `VITE_API_URL=https://<your-render-backend-url>/api`
5. Click **Deploy**. Vercel will automatically read `vercel.json` to handle client-side single page app routing.

---

## 💬 Interview Presentation Cheat Sheet

### Q1: How do you prevent floating-point rounding errors in financial transactions?
> *"In JavaScript and standard database floats, IEEE-754 binary floating-point representation causes precision loss (e.g. `0.1 + 0.2 === 0.30000000000000004`). In MySQL, I specifically configured balances and amounts as `DECIMAL(15, 2)`—which stores numbers in exact base-10 binary-coded decimal format. On the backend, we enforce strict currency formatting and database check constraints (`chk_balance_non_negative`, `chk_amount_positive`)."*

### Q2: What happens if two people transfer money to each other at the exact same millisecond?
> *"If User A transfers to User B while User B transfers to User A, conventional row locking creates a deadlock: Thread 1 locks A and waits for B, while Thread 2 locks B and waits for A. To eliminate deadlocks, our transfer service locks accounts deterministically by their primary key IDs (`ORDER BY id ASC FOR UPDATE`). Because all worker threads acquire locks in the exact same global order, cyclic wait deadlocks are mathematically eliminated."*

### Q3: How do you verify that account balances haven't been tampered with?
> *"Every single debit, credit, or transfer writes an immutable event into the `transactions` ledger table. In our automated test suite, we implement double-entry reconciliation: we query all historic events, sum up all credits and debits, and assert that the mathematical sum equals the stored balance to the cent."*
