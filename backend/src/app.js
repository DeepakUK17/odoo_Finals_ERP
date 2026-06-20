require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ─── Middleware ───────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Routes ──────────────────────────────────
app.use('/api/auth',            require('./routes/auth.routes'));
app.use('/api/products',        require('./routes/products.routes'));
app.use('/api/sales',           require('./routes/sales.routes'));
app.use('/api/purchase',        require('./routes/purchase.routes'));
app.use('/api/manufacturing',   require('./routes/manufacturing.routes'));
app.use('/api/bom',             require('./routes/bom.routes'));
app.use('/api/audit',           require('./routes/audit.routes'));
app.use('/api/dashboard',       require('./routes/dashboard.routes'));
app.use('/api/notifications',   require('./routes/notifications.routes'));
app.use('/api/ai',              require('./routes/ai.routes'));

// ─── Health Check ────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'Mini ERP - Shiv Furniture Works' });
});

// ─── 404 Handler ────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ───────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ─── Start Server ────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Mini ERP Backend running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔑 API Base: http://localhost:${PORT}/api\n`);
});
