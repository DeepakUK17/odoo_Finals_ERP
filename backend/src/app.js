require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ─── Middleware ───────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ─── Static Files ────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Global No-Cache Middleware ──────────────
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  next();
});

// ─── Global Socket Emitter Middleware ────────
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 300) {
       if (req.originalUrl.startsWith('/api/')) {
          const module = req.originalUrl.split('/')[2];
          const socketManager = require('./lib/socket');
          // Add a small delay to ensure DB transaction is fully committed and propagated
          setTimeout(() => {
            socketManager.emitDataUpdated(module);
          }, 100);
       }
    }
    return originalJson.call(this, data);
  };
  next();
});

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
app.use('/api/attendance',      require('./routes/attendance.routes'));
app.use('/api/leaves',          require('./routes/leaves.routes'));
app.use('/api/upload',          require('./routes/upload.routes'));
app.use('/api/stock-ledger',    require('./routes/stockledger.routes'));
app.use('/api/storefront',      require('./routes/storefront.routes'));


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
const server = http.createServer(app);

// Initialize Socket.io
const socketManager = require('./lib/socket');
socketManager.init(server);

server.listen(PORT, () => {
  console.log(`\n🚀 Mini ERP Backend running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔑 API Base: http://localhost:${PORT}/api\n`);
});
