const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

// GET /api/stock-ledger — full ledger with optional product filter
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { productId, type, limit = 200, offset = 0 } = req.query;
    const where = {};
    if (productId) where.productId = productId;
    if (type) where.type = type;

    const [entries, total] = await Promise.all([
      prisma.stockLedger.findMany({
        where,
        include: { product: { select: { id: true, name: true, unit: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      }),
      prisma.stockLedger.count({ where })
    ]);

    res.json({ success: true, data: entries, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) { next(err); }
});

// GET /api/stock-ledger/summary — aggregate stock movement summary per product
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, unit: true, onHandQty: true, reservedQty: true, minStockLevel: true }
    });

    const summary = await Promise.all(products.map(async (p) => {
      const ledger = await prisma.stockLedger.groupBy({
        by: ['type'],
        where: { productId: p.id },
        _sum: { qty: true }
      });
      const totalIn = ledger
        .filter(l => ['purchase_receipt', 'manufacturing_output', 'opening_stock', 'adjustment'].includes(l.type) && (l._sum.qty || 0) > 0)
        .reduce((s, l) => s + (l._sum.qty || 0), 0);
      const totalOut = Math.abs(ledger
        .filter(l => (l._sum.qty || 0) < 0)
        .reduce((s, l) => s + (l._sum.qty || 0), 0));
      return { ...p, totalIn, totalOut, freeToUse: Math.max(0, p.onHandQty - p.reservedQty) };
    }));

    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

module.exports = router;
