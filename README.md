<div align="center">
  <img src="frontend\public\favicon.png" alt="Shiv Furniture Works Logo" style="border-radius: 12px;width:100px;height:100px; margin-bottom: 20px;" />
  <h1>🪑 Shiv Furniture Works - ERP System</h1>
  <p><strong>A Modern, Local-First, AI-Powered Enterprise Resource Planning System</strong></p>
  
  [![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-ORM-1B222D.svg)](https://www.prisma.io/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791.svg)](https://www.postgresql.org/)
  [![Gemini AI](https://img.shields.io/badge/AI-Gemini%201.5-orange.svg)](https://deepmind.google/technologies/gemini/)
</div>

<hr />

## 📖 Project Overview

This is a comprehensive ERP system tailor-made for **Shiv Furniture Works**. Designed with a premium, glassmorphic UI, it streamlines the complete manufacturing business lifecycle—from sales and raw material purchasing to manufacturing execution and inventory management. 

At the heart of the system is a **Role-Based AI Assistant** powered by Google Gemini, capable of giving real-time, context-aware, and secure business insights directly from the live database.

---

## ✨ Key Achievements (What We've Built)

### 1. 🔄 Fully Automated Procurement Workflows
- **Make-to-Order (MTO):** Sales Orders automatically trigger Manufacturing Orders (MO) if a product's procurement route is set to MTO.
- **Smart Auto-Purchasing:** If a Manufacturing Order lacks raw materials, the system automatically drafts Purchase Orders (PO) for the required components.
- **Quantity Optimization:** Auto-POs intelligently respect minimum reorder quantities and check for existing pending POs to prevent duplicate ordering of the same raw materials.

### 2. 🛡️ Robust Role-Based Access Control (RBAC)
- Five distinct user roles: **Admin**, **Sales**, **Manufacturing**, **Purchasing**, and **Inventory**.
- Strict frontend and backend enforcement.
- Financial confidentiality: Roles like *Sales* are physically restricted from viewing component costs, profit margins, or procurement secrets.

### 3. 🤖 Secure, Role-Aware AI Assistant
- Integrated with **Gemini 1.5 Flash**.
- **Time & Context Aware:** AI automatically reads the latest 30 sales orders, 20 purchase/manufacturing orders, current inventory, and low stock alerts before answering.
- **Security-First:** The AI receives the logged-in user's role. If a *Sales* user asks for profit margins, the AI is strictly instructed to politely refuse, protecting financial data.

### 4. 🎨 Premium UI/UX & Print-Ready Reports
- Custom-built dark-mode UI utilizing modern glassmorphism.
- Fully responsive dashboards with contextual charts.
- **Print Optimization:** Invoices and Bills of Material dynamically switch to clean, white backgrounds with correct branding alignments specifically for printing.
- **Failsafe UX:** Destructive or critical actions (like completing an MO with missing components) feature greyed-out buttons and toast warnings instead of application crashes.

### 5. 📜 Comprehensive Audit Logging
- Every create, update, or status change across any module is recorded with the user's name, timestamp, and detailed description, ensuring full traceability.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** (v18+)
- **PostgreSQL** (v17+)

### 1. Database Setup
1. Create a PostgreSQL database named `mini_erp_db`.
2. Navigate to `backend/.env` and update the `DATABASE_URL` with your local PostgreSQL credentials:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/mini_erp_db?schema=public"
   GEMINI_API_KEY="your_api_key_here"
   ```

### 2. Backend Setup
Open a terminal and run:
```bash
cd backend
npm install
npx prisma migrate dev --name init
node prisma/seed.js   # Seeds database with demo products, users, and routing
npm start             # Starts server on http://localhost:5000
```

### 3. Frontend Setup
Open a second terminal and run:
```bash
cd frontend
npm install
npm run dev           # Starts app on http://localhost:5173
```

---

## 👥 Demo Accounts

Use these accounts to explore the RBAC features:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@shiv.com | Admin@123 |
| **Sales** | sales@shiv.com | Sales@123 |
| **Purchase** | purchase@shiv.com | Purchase@123 |
| **Manufacturing** | mfg@shiv.com | Mfg@123 |
| **Inventory** | inventory@shiv.com | Inv@123 |

---

## 🔮 Outstanding Items & Future Improvements

While the MVP is highly capable, the following areas are earmarked for future iterations:
- **Authentication:** Upgrade from plain-text demo passwords to hashed passwords (`bcrypt`) in the database.
- **Routing Overhaul:** Transition the frontend to `react-router-dom` for robust URL management, history tracking, and deep linking (currently using state-based routing).
- **Payment & Invoicing Integration:** Add tracking for partial payments, credit notes, and external payment gateway links (e.g., Stripe/Razorpay).
- **Advanced Manufacturing:** Support for multi-level Bills of Materials (BoM), routing operations with specific machine time scheduling, and worker shifts.
- **Vendor & Customer Portals:** Allow external parties to log in and view their specific POs or SOs.

---
*Built with ❤️ for Shiv Furniture Works*
