# 🤖 AI MASTER GUIDE — Mini ERP: From Demand to Delivery
> **READ THIS FIRST before doing ANYTHING.** This file is the single source of truth for any AI model (Claude, Gemini, GPT, etc.) working on this project. It logs everything done, what's pending, key decisions, and how to continue safely.

---

## 📌 Project Identity
| Field | Value |
|-------|-------|
| **Project Name** | Mini ERP — Shiv Furniture Works |
| **Hackathon** | Odoo Hackathon — Final Round (24 Hours) |
| **Round Date** | 20–21 June 2026 |
| **Problem Statement** | "Mini ERP: From Demand to Delivery" |
| **Workspace Path** | `d:\Odoo Finals\` |
| **Prize** | Winner: ₹45,000 + Goodies |
| **Current AI Model** | Claude Sonnet 4.6 (Thinking) |

---

## 🧠 AI Model Continuity Protocol
> **If you are a new AI model or the session has restarted, follow these steps in order:**

1. **Read this entire file top to bottom**
2. **Check `PROGRESS_LOG.md`** for the latest completed tasks
3. **Check `DECISIONS_LOG.md`** for all architectural decisions made
4. **Check `ERRORS_LOG.md`** for known bugs or blockers
5. **Read `implementation_plan.md`** to understand what still needs to be done
6. **Never redo completed work** — always check logs first
7. **If uncertain**, add a question to the bottom of this file under `## ❓ Open Questions`

---

## 🎯 Problem Statement Summary (MUST READ)
**The challenge is to build a Mini ERP system for "Shiv Furniture Works"** — a furniture manufacturing company.

### Core Modules Required
| # | Module | Description |
|---|--------|-------------|
| 1 | **Products** | Product catalog with pricing, stock, procurement type |
| 2 | **Sales** | Sales orders → delivery → stock deduction |
| 3 | **Purchase** | Purchase orders → receive → stock increase |
| 4 | **Manufacturing** | Manufacturing orders using BoM |
| 5 | **Bill of Materials (BoM)** | Component recipes for products |
| 6 | **Audit Logs** | Track every state/quantity/price change |
| 7 | **User Access Rights** | Role-based access per module |

### Key Business Logic (CRITICAL — don't skip)
- **Free To Use Qty = On Hand Qty − Reserved Qty**
- **MTS (Make To Stock)**: Deliver directly from stock if available
- **MTO (Make To Order)**: Auto-create Manufacturing Order OR Purchase Order when sales order is confirmed and stock is insufficient
- **Procurement automation**: When a sales order is confirmed → check stock → if shortage → auto-create MO or PO based on product's procurement type
- **Stock Ledger**: Every movement (sale, purchase receipt, manufacturing completion) MUST be tracked

### Inventory Movement Chain
```
Sales Order Confirmed
       ↓
Check Stock Availability
       ↓
[Sufficient → Reserve → Deliver → Deduct Stock]
[Insufficient → Auto-create MO or PO → Manufacture/Receive → Deliver]
       ↓
Audit Log Entry Created
```

### Manufacturing Flow
```
Create MO → Fetch BoM components → Reserve components → 
Execute Work Orders → Add finished goods to stock → 
Deduct components from stock → Update Audit Log
```

### Sales Order States
`Draft → Confirmed → Partially Delivered → Fully Delivered`  
OR: `Draft → Cancelled`

### Purchase Order States
`Draft → Confirmed → Partially Received → Fully Received`

---

## 🏗️ Tech Stack Decisions

### Backend
| Component | Technology | Reason |
|-----------|-----------|--------|
| Server | **Node.js + Express** | Fast, widely used, hackathon-friendly |
| Database | **Local PostgreSQL v17** ✅ | Hackathon REQUIRES local DB. Supabase/Firebase = disqualification |
| ORM | **Prisma** | Clean schema, migrations, type-safe |
| Auth | **JWT + bcrypt** | Secure, stateless |
| Validation | **Zod** | Runtime input validation |
| AI | **Gemini free tier** ✅ | 15 req/min free, user confirmed key from aistudio |

### Frontend
| Component | Technology | Reason |
|-----------|-----------|--------|
| Framework | **React + Vite** | Fast dev experience |
| Styling | **Vanilla CSS + CSS Variables** | Clean, custom, no Tailwind |
| Charts | **Chart.js** | Dashboard visualizations |
| Icons | **Lucide React** | Clean icon set |
| Flow Viz | **ReactFlow** | Live business flow visualization |
| Fonts | **Google Fonts (Inter/Outfit)** | Premium typography |

### AI Features (Added Advantage)
| Feature | Implementation |
|---------|---------------|
| AI Business Assistant | Gemini API (free tier) — context = DB query results |
| Inventory Risk Predictor | Rule-based algorithm + simple heuristics |
| Business Digital Twin | Frontend simulation using historical averages |
| Procurement Intelligence | Auto-calculation from BoM + stock levels |
| Notification Bell | Real-time alerts (polling or WebSocket) |

---

## 📁 Project File Structure
```
d:\Odoo Finals\
├── AI_GUIDE.md              ← THIS FILE (AI reads first)
├── PROGRESS_LOG.md          ← Completed tasks log
├── DECISIONS_LOG.md         ← Architectural decisions
├── ERRORS_LOG.md            ← Known bugs/blockers
├── implementation_plan.md   ← Detailed plan with tasks
├── Content to AI/           ← Hackathon documents (don't modify)
│   ├── My Plane.md          ← User's original thoughts
│   ├── Mini ERP From Demand to Delivery.docx
│   └── MINI ERP.png         ← UI mockup diagram
├── backend/                 ← Node.js + Express + Prisma
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── products.routes.js
│   │   │   ├── sales.routes.js
│   │   │   ├── purchase.routes.js
│   │   │   ├── manufacturing.routes.js
│   │   │   ├── bom.routes.js
│   │   │   ├── audit.routes.js
│   │   │   └── ai.routes.js
│   │   ├── controllers/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   └── role.middleware.js
│   │   ├── services/
│   │   │   ├── procurement.service.js
│   │   │   ├── stock.service.js
│   │   │   └── ai.service.js
│   │   └── app.js
│   ├── .env
│   └── package.json
└── frontend/                ← React + Vite
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── Products.jsx
    │   │   ├── Sales.jsx
    │   │   ├── Purchase.jsx
    │   │   ├── Manufacturing.jsx
    │   │   ├── BillOfMaterials.jsx
    │   │   ├── AuditLogs.jsx
    │   │   └── UserManagement.jsx
    │   ├── components/
    │   │   ├── Sidebar.jsx
    │   │   ├── Header.jsx
    │   │   ├── NotificationBell.jsx
    │   │   ├── AIAssistant.jsx
    │   │   ├── BusinessFlowViz.jsx
    │   │   ├── InventoryRiskCard.jsx
    │   │   └── DigitalTwin.jsx
    │   ├── context/
    │   ├── hooks/
    │   ├── api/
    │   └── styles/
    │       └── index.css
    └── package.json
```

---

## 🔑 API Keys & Environment Variables
> **IMPORTANT**: Never commit `.env` to Git. Use `.env.example` for structure.

### Backend `.env` file location: `d:\Odoo Finals\backend\.env`
```env
# Database
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/mini_erp_db"

# Auth
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_EXPIRES_IN="24h"

# Server
PORT=5000
NODE_ENV=development

# AI Assistant (Gemini)
GEMINI_API_KEY="your-gemini-api-key-here"
# Get from: https://aistudio.google.com/app/apikey (FREE tier available)
# If key expires/changes → update only this line

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"
```

### Frontend `.env` file location: `d:\Odoo Finals\frontend\.env`
```env
VITE_API_URL="http://localhost:5000/api"
VITE_APP_NAME="ShivERP"
```

### Where to Get API Keys
| Key | Where to Get | Cost |
|-----|-------------|------|
| `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey | FREE (15 req/min) |
| PostgreSQL | Local install, no key needed | FREE |
| JWT_SECRET | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` | FREE |

---

## 📊 Database Schema Overview
> Full schema in `backend/prisma/schema.prisma`

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles |
| `products` | Product catalog |
| `stock_ledger` | Every inventory movement |
| `sales_orders` | Customer orders |
| `sales_order_items` | Line items of sales orders |
| `purchase_orders` | Supplier orders |
| `purchase_order_items` | Line items of purchase orders |
| `manufacturing_orders` | Production orders |
| `work_orders` | Individual manufacturing steps |
| `bill_of_mat| # | Status | Task | Date |
|---|--------|------| -----|
| 1 | ✅ | Read and analyzed all hackathon documents | 2026-06-20 |
| 2 | ✅ | Created AI_GUIDE.md | 2026-06-20 |
| 3 | ✅ | Created implementation_plan.md | 2026-06-20 |
| 4 | ✅ | PostgreSQL database created (mini_erp_db) | 2026-06-20 |
| 5 | ✅ | Backend project init (Node.js + npm) | 2026-06-20 |
| 6 | ✅ | Prisma schema (14 tables — all models) | 2026-06-20 |
| 7 | ✅ | Database migration applied | 2026-06-20 |
| 8 | ✅ | Auth module (login/JWT/RBAC/users) | 2026-06-20 |
| 9 | ✅ | Products API (CRUD + stock ledger) | 2026-06-20 |
| 10 | ✅ | Sales API (MTS/MTO confirm + deliver + cancel) | 2026-06-20 |
| 11 | ✅ | Purchase API (confirm + receive + stock update) | 2026-06-20 |
| 12 | ✅ | Manufacturing API (MO + Work Orders + complete) | 2026-06-20 |
| 13 | ✅ | BoM API (CRUD + work centers) | 2026-06-20 |
| 14 | ✅ | Audit Logs API | 2026-06-20 |
| 15 | ✅ | Dashboard API (role-based KPIs + digital twin) | 2026-06-20 |
| 16 | ✅ | Notifications API (bell + mark read) | 2026-06-20 |
| 17 | ✅ | AI Assistant API (Gemini + DB context) | 2026-06-20 |
| 18 | ✅ | Procurement Service (auto MO/PO on MTO) | 2026-06-20 |
| 19 | ✅ | Stock Service (updateStock + ledger) | 2026-06-20 |
| 20 | ✅ | Audit Service + Notification Service | 2026-06-20 |
| 21 | ✅ | Database seeded (5 users, 12 products, 3 BoMs) | 2026-06-20 |
| 22 | ✅ | Backend server running on port 5000 ✅ | 2026-06-20 |
| 23 | ✅ | Frontend project init (React + Vite) | 2026-06-20 |
| 24 | ✅ | CSS Design System (premium dark theme) | 2026-06-20 |
| 25 | ✅ | Sidebar (role-based nav filtering) | 2026-06-20 |
| 26 | ✅ | Header + Notification Bell | 2026-06-20 |
| 27 | ✅ | AI Assistant panel | 2026-06-20 |
| 28 | ✅ | Auth Context + Toast Context | 2026-06-20 |
| 29 | ✅ | Login page (with demo role quick-fill) | 2026-06-20 |
| 30 | ✅ | App router (all routes) | 2026-06-20 |
| 31 | ✅ | Frontend running on port 5173 ✅ | 2026-06-20 |
| 32 | ✅ | Dashboard page (KPIs + charts + flow viz) | 2026-06-20 |
| 33 | ✅ | Products page (full CRUD) | 2026-06-20 |
| 34 | ✅ | Sales page (order flow + deliver) | 2026-06-20 |
| 35 | ✅ | Purchase page (order flow + receive) | 2026-06-20 |
| 36 | ✅ | Manufacturing page (work orders kanban) | 2026-06-20 |
| 37 | ✅ | BoM page (component tree) | 2026-06-20 |
| 38 | ✅ | Audit Logs page | 2026-06-20 |
| 39 | ✅ | User Management page | 2026-06-20 |
| 40 | ⬜ | Git init + README | — |tem (CSS variables, fonts) | — |
| 16 | ⬜ | Sidebar + Header + Layout | — |
| 17 | ⬜ | Dashboard page | — |
| 18 | ⬜ | Products page (CRUD) | — |
| 19 | ⬜ | Sales page (CRUD + flow) | — |
| 20 | ⬜ | Purchase page (CRUD + flow) | — |
| 21 | ⬜ | Manufacturing page (CRUD + work orders) | — |
| 22 | ⬜ | BoM page | — |
| 23 | ⬜ | Audit Logs page | — |
| 24 | ⬜ | AI Assistant panel | — |
| 25 | ⬜ | Business Flow Visualization | — |
| 26 | ⬜ | Notification Bell | — |
| 27 | ⬜ | Inventory Risk Predictor | — |
| 28 | ⬜ | Business Digital Twin (30-day simulation) | — |
| 29 | ⬜ | User Management page | — |
| 30 | ⬜ | Seed data (demo furniture products) | — |
| 31 | ⬜ | End-to-end testing | — |
| 32 | ⬜ | Git setup + README | — |

---

## 🔴 ERRORS & BLOCKERS LOG
> Add any errors encountered here so the next session knows what to avoid.

| # | Error | Status | Fix Applied |
|---|-------|--------|-------------|
| — | None yet | — | — |

---

## 🏛️ Architectural Decisions Log
> Every major decision made during the project.

| # | Decision | Reason | Date |
|---|----------|--------|------|
| 1 | Use LOCAL PostgreSQL v17 (NOT Supabase/Firebase) | Hackathon video explicitly says "local DB only" — Supabase = rule violation | 2026-06-20 |
| 2 | Use Prisma ORM | Type-safe, clean schema migrations | 2026-06-20 |
| 3 | Use React + Vite (not Next.js) | Faster setup, no SSR needed for ERP | 2026-06-20 |
| 4 | Vanilla CSS (no Tailwind) | Hackathon prefers custom, non-generic UI | 2026-06-20 |
| 5 | Gemini API for AI (free tier from aistudio.google.com) | User confirmed, free 15 req/min | 2026-06-20 |
| 6 | AI is context-injected (not fine-tuned) | Query DB → inject as context → Gemini responds | 2026-06-20 |
| 7 | JWT for auth (not sessions) | Stateless, works well with React SPA | 2026-06-20 |
| 8 | ReactFlow for Business Flow Viz | Best library for node-based flow diagrams | 2026-06-20 |
| 9 | Solo Git strategy: single main branch | Only 1 team member — no need for feature branches | 2026-06-20 |

---

## ❓ Open Questions / Clarifications Needed
> Add questions here if unsure. Don't proceed with guesses on critical items.

| # | Question | Status | Answer |
|---|----------|--------|--------|
| 1 | Which Gemini model to use? (gemini-1.5-flash vs pro) | Open | — |
| 2 | Should notifications be real-time WebSocket or polling? | Decided: polling (simpler for hackathon) | — |
| 3 | Team size? (affects Git branch strategy) | Open | — |

---

## 🔄 If AI Model Changed / Session Reset — Quick Restart Checklist
```
1. [ ] Read this entire AI_GUIDE.md
2. [ ] Check PROGRESS_LOG section above for completed tasks
3. [ ] Check ERRORS LOG for any blockers
4. [ ] Read implementation_plan.md for pending tasks
5. [ ] Run: cd "d:\Odoo Finals\backend" && npm run dev  (check if backend is running)
6. [ ] Run: cd "d:\Odoo Finals\frontend" && npm run dev (check if frontend is running)
7. [ ] Check PostgreSQL: psql -U postgres -d mini_erp_db -c "\dt" (list tables)
8. [ ] Continue from the first ⬜ (unchecked) task in PROGRESS LOG
```

---

## 📋 Hackathon Evaluation Criteria (Don't Forget!)
- ✅ **Coding Standard** — Clean, commented, modular code
- ✅ **Logic** — Correct MTS/MTO, stock calculation, procurement automation
- ✅ **Modularity** — Separate routes, controllers, services
- ✅ **Frontend Design** — NOT generic! Custom, premium, animated UI
- ✅ **Performance & Scalability** — Indexed DB, paginated lists
- ✅ **Security** — JWT, role-based access, input validation (Zod)
- ✅ **Usability** — Intuitive navigation, proper spacing
- ✅ **Debugging Skills** — Good error handling, meaningful error messages
- ✅ **Database Design** — Normalized schema, proper relations, indexes
- ✅ **Modern Architecture** — MVC pattern, separation of concerns
- ✅ **Git Usage** — Multiple branches, meaningful commits by all members

---

## 🚀 Quick Dev Commands
```bash
# PostgreSQL is installed at: C:\Program Files\PostgreSQL\17\
# It is NOT in system PATH by default — use full path or add to PATH
# psql path: C:\Program Files\PostgreSQL\17\bin\psql.exe

# Start PostgreSQL service (Windows)
net start postgresql-x64-17

# Connect to PostgreSQL (use full path if not in PATH)
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres

# Create the database
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres mini_erp_db

# Start Backend
cd "d:\Odoo Finals\backend"
npm run dev

# Start Frontend  
cd "d:\Odoo Finals\frontend"
npm run dev

# Prisma commands (run from backend folder)
npx prisma migrate dev --name <migration-name>
npx prisma studio   # Visual DB viewer at localhost:5555
npx prisma db seed  # Seed demo data

# Git
git status
git add .
git commit -m "feat: <description>"
git push origin main
```

### Environment Versions (Verified 2026-06-20)
| Tool | Version | Status |
|------|---------|--------|
| Node.js | v23.5.0 | ✅ Installed |
| npm | v11.6.4 | ✅ Installed |
| Git | v2.47.1 | ✅ Installed |
| PostgreSQL | v17 (at C:\Program Files\PostgreSQL\17\) | ✅ Installed (not in PATH) |

---

## 📝 Notes From User
- UI must be **different, attractive, and premium** — NOT modern generic UI
- Logic must be **perfect** — no compromises on business flow
- The SVG and Excalidraw files have additional UI mockup details
- Must work **offline** (local DB, minimal external API dependency)
- AI features should be **useful additions**, not gimmicks
- Use Git properly with all team members committing

---
*Last Updated: 2026-06-20 | Updated By: Claude Sonnet 4.6 (Thinking)*
*Next AI: Update the "Last Updated" line and "Current AI Model" at the top when you take over*
