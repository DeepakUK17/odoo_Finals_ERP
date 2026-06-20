# Shiv Furniture Works - Mini ERP 🪑

This is a comprehensive, local-first ERP system designed for **Shiv Furniture Works** as part of a 24-hour hackathon. The system manages the full business lifecycle from Sales and Manufacturing to Inventory and Purchasing, featuring an integrated AI Business Assistant.

## 🚀 Quick Start

Ensure you have **Node.js** and **PostgreSQL (v17)** installed.

### 1. Database Setup
1. Create a PostgreSQL database named `mini_erp_db`.
2. Update the `DATABASE_URL` in `backend/.env` with your PostgreSQL credentials.

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma migrate dev --name init
node prisma/seed.js # Optional: seeds dummy data
npm start
```
The backend server runs on `http://localhost:5000`

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The frontend server runs on `http://localhost:5173`

## 🔑 Default Users (Demo)
- **Admin**: admin@shiv.com / Admin@123
- **Sales**: sales@shiv.com / Sales@123
- **Purchase**: purchase@shiv.com / Purchase@123
- **Manufacturing**: mfg@shiv.com / Mfg@123

## 🌟 Key Features
- **Role-Based Access Control**: Different dashboards and permissions for Admin, Sales, Purchase, Manufacturing, and Inventory.
- **Smart Procurement Flow**: Automatically triggers Manufacturing Orders (MO) or Purchase Orders (PO) when Sales Orders (SO) face stock shortages.
- **AI Business Assistant**: Integrated with Gemini 1.5 Flash to provide real-time business insights based on the live database.
- **Audit Logging**: Comprehensive system-wide tracking of user actions.
- **Premium UI**: Custom-designed, dark-themed responsive frontend built with React, Vite, and CSS Variables.

## 🛠️ Tech Stack
- **Frontend**: React.js, Vite, Axios, Chart.js, Lucide-React
- **Backend**: Node.js, Express.js, Prisma ORM, JSON Web Tokens (JWT)
- **Database**: PostgreSQL (Local)
- **AI Engine**: Google Gemini API
