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

    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Gather real-time business context from DB
    const [products, salesOrders, purchaseOrders, manufacturingOrders, lowStock, recentLogs] = await Promise.all([
      prisma.product.findMany({ where: { isActive: true }, select: { name: true, onHandQty: true, reservedQty: true, minStockLevel: true, productType: true, procurementType: true, salesPrice: true, costPrice: true } }),
      prisma.salesOrder.findMany({ orderBy: { createdAt: 'desc' }, include: { items: { include: { product: { select: { name: true } } } } }, take: 30 }),
      prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.manufacturingOrder.findMany({ orderBy: { createdAt: 'desc' }, include: { product: { select: { name: true } } }, take: 20 }),
      prisma.product.findMany({ where: { isActive: true } }).then(ps => ps.filter(p => p.onHandQty <= p.minStockLevel)),
      prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 15, select: { action: true, model: true, description: true } })
    ]);

    const context = `
You are an AI Business Assistant for Shiv Furniture Works, a furniture manufacturing ERP system. 
You have access to real-time business data. Be concise, actionable, and specific.
Today's Date: ${new Date().toLocaleDateString('en-IN')}

=== USER ROLE ===
The user asking the question has the role: "${req.user.role}".
ROLE-BASED RESTRICTIONS:
- If the role is "sales", DO NOT reveal profit, cost price, procurement costs, or financial details of manufacturing under any circumstances. You must politely refuse such requests.
- If the role is "inventory", focus on stock levels.
- If the role is "admin", you have full unrestricted access to all data including profits and costs.

=== CURRENT INVENTORY ===
${products.map(p => `${p.name}: ${p.onHandQty} on hand, ${p.reservedQty} reserved, free-to-use: ${Math.max(0, p.onHandQty - p.reservedQty)}, min level: ${p.minStockLevel}${req.user.role === 'admin' ? `, Cost: ₹${p.costPrice}, Sale: ₹${p.salesPrice}` : ''}`).join('\n')}

=== LOW STOCK ALERTS ===
${lowStock.length > 0 ? lowStock.map(p => `⚠ ${p.name}: only ${p.onHandQty} remaining`).join('\n') : 'No low stock items'}

=== RECENT SALES ORDERS (Last 30) ===
${salesOrders.length > 0 ? salesOrders.map(o => `${o.orderNo} for ${o.customer} on ${o.createdAt.toLocaleDateString()} (${o.status}): ${o.items.map(i => `${i.qty}×${i.product?.name || 'Item'}`).join(', ')}`).join('\n') : 'No recent sales orders'}

=== RECENT PURCHASE ORDERS (Last 20) ===
${purchaseOrders.length > 0 ? purchaseOrders.map(o => `${o.orderNo} from ${o.vendor} on ${o.createdAt.toLocaleDateString()} (${o.status})`).join('\n') : 'No recent purchase orders'}

=== RECENT MANUFACTURING ORDERS (Last 20) ===
${manufacturingOrders.length > 0 ? manufacturingOrders.map(o => `${o.orderNo} on ${o.createdAt.toLocaleDateString()}: ${o.qty}×${o.product?.name || 'Item'} (${o.status})`).join('\n') : 'No recent manufacturing orders'}

=== RECENT ACTIVITY ===
${recentLogs.map(l => `${l.action} on ${l.model}: ${l.description}`).join('\n')}
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
