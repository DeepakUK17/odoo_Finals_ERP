const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/ai/chat
router.post('/chat', authMiddleware, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'YOUR_GEMINI_KEY_HERE') {
      return res.status(503).json({ success: false, message: 'AI assistant not configured. Add GEMINI_API_KEY to .env' });
    }

    // Gather real-time business context from DB
    const [products, salesOrders, purchaseOrders, manufacturingOrders, lowStock, recentLogs] = await Promise.all([
      prisma.product.findMany({ where: { isActive: true }, select: { name: true, onHandQty: true, reservedQty: true, minStockLevel: true, productType: true, procurementType: true } }),
      prisma.salesOrder.findMany({ where: { status: { in: ['confirmed', 'partially_delivered'] } }, include: { items: { include: { product: { select: { name: true } } } } }, take: 10 }),
      prisma.purchaseOrder.findMany({ where: { status: { in: ['draft', 'confirmed', 'partially_received'] } }, take: 5 }),
      prisma.manufacturingOrder.findMany({ where: { status: { in: ['draft', 'confirmed', 'in_progress'] } }, include: { product: { select: { name: true } } }, take: 5 }),
      prisma.product.findMany({ where: { isActive: true } }).then(ps => ps.filter(p => p.onHandQty <= p.minStockLevel)),
      prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 5, select: { action: true, model: true, description: true } })
    ]);

    const context = `
You are an AI Business Assistant for Shiv Furniture Works, a furniture manufacturing ERP system. 
You have access to real-time business data. Be concise, actionable, and specific.

=== CURRENT INVENTORY ===
${products.map(p => `${p.name}: ${p.onHandQty} on hand, ${p.reservedQty} reserved, free-to-use: ${Math.max(0, p.onHandQty - p.reservedQty)}, min level: ${p.minStockLevel}`).join('\n')}

=== LOW STOCK ALERTS ===
${lowStock.length > 0 ? lowStock.map(p => `⚠ ${p.name}: only ${p.onHandQty} remaining`).join('\n') : 'No low stock items'}

=== PENDING SALES ORDERS ===
${salesOrders.length > 0 ? salesOrders.map(o => `${o.orderNo} for ${o.customer} (${o.status}): ${o.items.map(i => `${i.qty}×${i.product.name}`).join(', ')}`).join('\n') : 'No pending sales orders'}

=== ACTIVE PURCHASE ORDERS ===
${purchaseOrders.length > 0 ? purchaseOrders.map(o => `${o.orderNo} from ${o.vendor} (${o.status})`).join('\n') : 'No active purchase orders'}

=== ACTIVE MANUFACTURING ORDERS ===
${manufacturingOrders.length > 0 ? manufacturingOrders.map(o => `${o.orderNo}: ${o.qty}×${o.product.name} (${o.status})`).join('\n') : 'No active manufacturing orders'}

=== RECENT ACTIVITY ===
${recentLogs.map(l => `${l.action} on ${l.model}: ${l.description}`).join('\n')}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(`${context}\n\nUser Question: ${message}\n\nProvide a clear, actionable answer based on the data above.`);
    const text = result.response.text();

    res.json({ success: true, response: text });
  } catch (err) {
    console.error('Gemini error:', err.message);
    res.status(500).json({ success: false, message: 'AI service error: ' + err.message });
  }
});

// GET /api/ai/suggestions — pro-active suggestions
router.get('/suggestions', authMiddleware, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const lowStock = products.filter(p => p.onHandQty <= p.minStockLevel);
    const pendingSales = await prisma.salesOrder.count({ where: { status: { in: ['confirmed', 'partially_delivered'] } } });
    const activeMOs = await prisma.manufacturingOrder.count({ where: { status: { in: ['confirmed', 'in_progress'] } } });

    const suggestions = [];
    if (lowStock.length > 0) suggestions.push({ type: 'warning', text: `${lowStock.length} product(s) below minimum stock level`, action: 'View Products' });
    if (pendingSales > 0) suggestions.push({ type: 'info', text: `${pendingSales} sales order(s) awaiting delivery`, action: 'View Sales' });
    if (activeMOs > 0) suggestions.push({ type: 'info', text: `${activeMOs} manufacturing order(s) in progress`, action: 'View Manufacturing' });

    res.json({ success: true, data: suggestions });
  } catch (err) { next(err); }
});

module.exports = router;
