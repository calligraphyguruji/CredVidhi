# CredVidhi 🏦

> **Enterprise-Grade Loan Approval Processing & Underwriting Management System**

CredVidhi is an auditable, deterministic, and secure loan processing platform designed to streamline the complete lifecycle of retail and commercial credit originations—from digital borrower intake and document verification to mathematical risk evaluation and underwriting governance.

---

## 🌟 Key Features

- **🏛️ High-Trust FinTech Interface:** Crafted with an authentic Indian Saffron (`#EA580C` / `orange-600`) visual identity, responsive typography, and enterprise-grade layout design.
- **⚡ Deterministic Underwriting Cockpit:** Real-time Debt-to-Income (DTI) calculations, disposable income tracking, and reproducible mathematical risk scoring without arbitrary heuristics.
- **📄 Document Verification Pipeline:** Multi-tier document classification, optical extraction mockups, status checklists, and verification trails.
- **🛡️ Strict Role-Based Access Control (RBAC):** Distinct workflows and views for Borrowers, Loan Officers, Risk Underwriters, and Compliance Auditors.
- **📜 Immutable Audit Logging:** Full transaction envelope tracking all lifecycle events, state transitions, and actor actions.
- **✨ Production-Grade Motion System:** Fluid, restrained animations powered by Framer Motion—including count-up KPI metrics, page transitions, modal dialogs, and comprehensive accessibility (`prefers-reduced-motion` compliance).
- **🇮🇳 Rupee Currency Standard:** Native fixed-point formatting (`₹`) for all financial amounts and calculations.

---

## 🏗️ System Architecture

```text
                               ┌────────────────────────────────┐
                               │     CredVidhi Web Client       │
                               │  (React 19 + TypeScript + Vite)│
                               └───────────────┬────────────────┘
                                               │
                                 REST APIs / JSON Envelope
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │      FastAPI Core Engine       │
                               │   (Deterministic Underwriter)  │
                               └───────────────┬────────────────┘
                                               │
                      ┌────────────────────────┴────────────────────────┐
                      ▼                                                 ▼
        ┌───────────────────────────┐                     ┌───────────────────────────┐
        │       PostgreSQL 16       │                     │          Redis 7          │
        │ (ACID & Audit Immutability)│                    │  (Sessions & Cache Queue) │
        └───────────────────────────┘                     └───────────────────────────┘
```

### Tech Stack

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Motion & Interaction:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Planned Backend:** [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy 2.0 (Async)](https://www.sqlalchemy.org/), [Alembic](https://alembic.sqlalchemy.org/)
- **Database:** [PostgreSQL 16](https://www.postgresql.org/)

---

## 📂 Project Structure

```text
CredVidhi/
├── AGENTS.md                  # Autonomous agent operating protocol & governance
├── ARCHITECTURE.md            # Detailed technical stack & schema specifications
├── DECISIONS.md               # Architecture Decision Records (ADRs)
├── DESIGN.md                  # UI/UX guidelines, design tokens, and style rules
├── MEMORY.md                  # Project state and execution learnings
├── PRD.md                     # Comprehensive Product Requirements Document
├── RULES.md                   # Strict financial, database, and security constraints
├── TESTING.md                 # Test plan, linting, and quality verification gates
└── frontend/                  # React client application
    ├── src/
    │   ├── components/
    │   │   ├── landing/       # Landing page sections (Hero, Workflow, Products, etc.)
    │   │   ├── layout/        # Header, Sidebar, and App Shell
    │   │   └── ui/            # Button, Input, Modal, Card, Toast, AnimatedCounter
    │   ├── context/           # AppState & Global Notification Toast Context
    │   ├── pages/
    │   │   ├── applicant/     # Borrower application portal & multi-step wizard
    │   │   ├── public/        # Landing page & Authentication portal
    │   │   └── staff/         # Officer Queue & Underwriting Cockpit
    │   └── utils/             # Motion tokens, easing curves, and currency helpers
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/calligraphyguruji/CredVidhi.git
   cd CredVidhi
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

4. **Run production build & quality checks:**
   ```bash
   # Typecheck & build
   npm run build

   # Fast oxlint linter
   npm run lint
   ```

---

## 🔒 Security & Financial Governance

CredVidhi is built in compliance with non-negotiable core principles:
- **Zero Floating-Point Drift:** Financial calculations use fixed-point precision.
- **Sensitive Data Masking:** Identifiers (PAN, Aadhaar) are masked (`***-**-1234`) in logs and UI representations.
- **Audit Immutability:** Audit trail records cannot be edited or destroyed.
- **No Mock External Services Presented as Live:** Clear delineation of deterministic score evaluators versus production integrations.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
