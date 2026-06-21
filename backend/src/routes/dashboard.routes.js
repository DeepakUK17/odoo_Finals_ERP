const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

// GET /api/dashboard/summary
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const role = req.user.role;

    const [
      totalSales, pendingDeliveries, totalPurchase, partialReceipts,
      totalMO, activeMO, allProducts, totalEmployees, todayAttendance
    ] = await Promise.all([
      prisma.salesOrder.count(),
      prisma.salesOrder.count({ where: { status: { in: ['confirmed', 'partially_delivered'] } } }),
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: 'partially_received' } }),
      prisma.manufacturingOrder.count(),
      prisma.manufacturingOrder.count({ where: { status: { in: ['confirmed', 'in_progress'] } } }),
      prisma.product.findMany({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.attendance.findMany({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      })
    ]);

    const lowStockProducts = allProducts.filter(p => p.onHandQty <= p.minStockLevel);
    const totalStockValue = allProducts.reduce((sum, p) => sum + (p.onHandQty * p.costPrice), 0);
    const usersOnLeave = todayAttendance.filter(a => a.status === 'leave').length;
    const usersPresent = todayAttendance.filter(a => a.status === 'present').length;

    // Revenue & Orders this week (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recentSales = await prisma.salesOrder.findMany({
      where: { status: 'fully_delivered', deliveredAt: { gte: weekAgo } },
      select: { totalAmount: true }
    });
    const weeklyRevenue = recentSales.reduce((s, o) => s + o.totalAmount, 0);

    const weeklyOrdersCount = await prisma.salesOrder.count({
      where: { createdAt: { gte: weekAgo } }
    });

    // Role-based summary
    const summary = { role };
    if (['admin', 'sales'].includes(role)) {
      Object.assign(summary, { totalSales, pendingDeliveries, weeklyRevenue, weeklyOrders: weeklyOrdersCount });
    }
    if (['admin', 'purchase'].includes(role)) {
      Object.assign(summary, { totalPurchase, partialReceipts });
    }
    if (['admin', 'manufacturing'].includes(role)) {
      Object.assign(summary, { totalMO, activeMO });
    }
    if (['admin', 'inventory'].includes(role)) {
      Object.assign(summary, { lowStockCount: lowStockProducts.length, totalStockValue, totalProducts: allProducts.length });
    }
    if (['admin', 'hr'].includes(role)) {
      Object.assign(summary, { totalEmployees, usersOnLeave, usersPresent });
    }
    if (role === 'admin') {
      Object.assign(summary, {
        totalSales, pendingDeliveries, totalPurchase, partialReceipts,
        totalMO, activeMO, lowStockCount: lowStockProducts.length,
        totalStockValue, weeklyRevenue, weeklyOrders: weeklyOrdersCount, totalProducts: allProducts.length,
        totalEmployees, usersOnLeave, usersPresent
      });
    }

    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// GET /api/dashboard/low-stock
router.get('/low-stock', authMiddleware, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const lowStock = products
      .filter(p => p.onHandQty <= p.minStockLevel)
      .map(p => ({
        ...p,
        freeToUseQty: Math.max(0, p.onHandQty - p.reservedQty),
        severity: p.onHandQty === 0 ? 'critical' : p.onHandQty <= p.minStockLevel / 2 ? 'high' : 'medium'
      }))
      .sort((a, b) => a.onHandQty - b.onHandQty);
    res.json({ success: true, data: lowStock });
  } catch (err) { next(err); }
});

// GET /api/dashboard/recent-activity
router.get('/recent-activity', authMiddleware, async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 15,
      include: { user: { select: { name: true } } }
    });
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

// GET /api/dashboard/sales-chart — last 7 days revenue
router.get('/sales-chart', authMiddleware, async (req, res, next) => {
  try {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const [orders, count] = await Promise.all([
        prisma.salesOrder.findMany({ where: { createdAt: { gte: d, lt: next } }, select: { totalAmount: true } }),
        prisma.salesOrder.count({ where: { createdAt: { gte: d, lt: next } } })
      ]);
      const revenue = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
      days.push({ date: d.toISOString().split('T')[0], count, revenue });
    }
    res.json({ success: true, data: days });
  } catch (err) { next(err); }
});

// GET /api/dashboard/digital-twin — 30-day simulation
router.get('/digital-twin', authMiddleware, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true, productType: 'finished' } });

    // Calculate average daily sales from last 30 days
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const simulations = [];

    for (const product of products) {
      const deliveries = await prisma.stockLedger.findMany({
        where: { productId: product.id, type: 'sale_delivery', createdAt: { gte: thirtyDaysAgo } }
      });
      const totalConsumed = deliveries.reduce((s, d) => s + Math.abs(d.qty), 0);
      const avgDailyDemand = totalConsumed / 30;

      const projections = [];
      let currentStock = product.onHandQty;
      for (const day of [7, 15, 20, 30]) {
        currentStock = Math.max(0, product.onHandQty - (avgDailyDemand * day));
        projections.push({ day, stock: Math.round(currentStock * 10) / 10, stockOut: currentStock <= 0 });
      }
      const daysToStockOut = avgDailyDemand > 0 ? Math.floor(product.onHandQty / avgDailyDemand) : null;

      simulations.push({ product: { id: product.id, name: product.name, onHandQty: product.onHandQty }, avgDailyDemand: Math.round(avgDailyDemand * 100) / 100, projections, daysToStockOut });
    }

    res.json({ success: true, data: simulations });
  } catch (err) { next(err); }
});

module.exports = router;
