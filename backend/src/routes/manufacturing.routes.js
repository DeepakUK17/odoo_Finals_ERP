const express = require('express');
const router = express.Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createAuditLog } = require('../services/audit.service');
const { updateStock } = require('../services/stock.service');
const { createNotification, createNotificationsForLowStock } = require('../services/notification.service');

const moSchema = z.object({
  productId: z.string(),
  qty: z.number().positive(),
  bomId: z.string().optional(),
  scheduledDate: z.string().optional(),
  notes: z.string().optional()
});

// GET /api/manufacturing
router.get('/', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const orders = await prisma.manufacturingOrder.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, unit: true } },
        workOrders: { include: { workCenter: true, assignee: { select: { name: true } } } },
        moComponents: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
});

// GET /api/manufacturing/:id
router.get('/:id', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const order = await prisma.manufacturingOrder.findUnique({
      where: { id: req.params.id },
      include: {
        product: true,
        bom: { include: { components: { include: { product: true } }, workOperations: { include: { workCenter: true } } } },
        workOrders: { include: { workCenter: true, assignee: { select: { name: true } } }, orderBy: { sequence: 'asc' } },
        moComponents: { include: { product: { select: { id: true, name: true, onHandQty: true, unit: true } } } },
        auditLogs: { orderBy: { timestamp: 'desc' }, include: { user: { select: { name: true } } } }
      }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Manufacturing order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// POST /api/manufacturing
router.post('/', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const { productId, qty, bomId, scheduledDate, notes } = moSchema.parse(req.body);

    const lastOrder = await prisma.manufacturingOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const lastNum = lastOrder ? parseInt(lastOrder.orderNo.split('-')[1]) : 0;
    const orderNo = `MO-${String(lastNum + 1).padStart(4, '0')}`;

    // Auto-fetch BoM if not provided
    let resolvedBomId = bomId;
    let bom = null;
    if (!resolvedBomId) {
      bom = await prisma.billOfMaterials.findFirst({
        where: { productId, isActive: true },
        include: { components: true, workOperations: true }
      });
      resolvedBomId = bom?.id;
    } else {
      bom = await prisma.billOfMaterials.findUnique({
        where: { id: resolvedBomId },
        include: { components: true, workOperations: true }
      });
    }

    const mo = await prisma.manufacturingOrder.create({
      data: {
        orderNo,
        productId,
        bomId: resolvedBomId || null,
        qty,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        notes,
        moComponents: bom ? {
          create: bom.components.map(c => ({ productId: c.productId, requiredQty: c.qty * qty, consumedQty: 0 }))
        } : undefined,
        workOrders: bom ? {
          create: bom.workOperations.map(op => ({ workCenterId: op.workCenterId, operation: op.operation, duration: op.duration, sequence: op.sequence, status: 'pending' }))
        } : undefined
      },
      include: {
        product: true,
        workOrders: { include: { workCenter: true } },
        moComponents: { include: { product: { select: { name: true, onHandQty: true } } } }
      }
    });

    await createAuditLog({ userId: req.user.id, action: 'CREATED', model: 'ManufacturingOrder', recordId: mo.id, description: `Manufacturing Order ${orderNo} created for ${qty} × ${mo.product.name}`, manufacturingOrderId: mo.id });
    res.status(201).json({ success: true, data: mo });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// POST /api/manufacturing/:id/confirm — reserve components
router.post('/:id/confirm', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const mo = await prisma.manufacturingOrder.findUnique({
      where: { id: req.params.id },
      include: { moComponents: { include: { product: true } }, product: true }
    });
    if (!mo) return res.status(404).json({ success: false, message: 'MO not found' });
    if (mo.status !== 'draft') return res.status(400).json({ success: false, message: 'Already confirmed' });

    // Reserve components
    const shortages = [];
    for (const comp of mo.moComponents) {
      const freeToUse = Math.max(0, comp.product.onHandQty - comp.product.reservedQty);
      if (freeToUse < comp.requiredQty) {
        shortages.push({ name: comp.product.name, required: comp.requiredQty, available: freeToUse });
      } else {
        await prisma.product.update({ where: { id: comp.productId }, data: { reservedQty: { increment: comp.requiredQty } } });
      }
    }

    const confirmed = await prisma.manufacturingOrder.update({
      where: { id: mo.id },
      data: { status: 'confirmed' },
      include: { product: true, workOrders: { orderBy: { sequence: 'asc' } }, moComponents: { include: { product: { select: { name: true } } } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CONFIRMED', model: 'ManufacturingOrder', recordId: mo.id, description: `MO ${mo.orderNo} confirmed. Components reserved.${shortages.length > 0 ? ` Shortages: ${shortages.map(s => s.name).join(', ')}` : ''}`, manufacturingOrderId: mo.id });
    res.json({ success: true, data: confirmed, shortages });
  } catch (err) { next(err); }
});

// POST /api/manufacturing/:id/work-orders/:woId/start
router.post('/:id/work-orders/:woId/start', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const wo = await prisma.workOrder.update({
      where: { id: req.params.woId },
      data: { status: 'in_progress', startedAt: new Date(), assigneeId: req.user.id }
    });
    await prisma.manufacturingOrder.update({ where: { id: req.params.id }, data: { status: 'in_progress' } });
    res.json({ success: true, data: wo });
  } catch (err) { next(err); }
});

// POST /api/manufacturing/:id/work-orders/:woId/complete
router.post('/:id/work-orders/:woId/complete', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const wo = await prisma.workOrder.update({
      where: { id: req.params.woId },
      data: { status: 'completed', completedAt: new Date() }
    });
    await createAuditLog({ userId: req.user.id, action: 'WORK_ORDER_COMPLETED', model: 'ManufacturingOrder', recordId: req.params.id, description: `Work order "${wo.operation}" completed`, manufacturingOrderId: req.params.id });
    res.json({ success: true, data: wo });
  } catch (err) { next(err); }
});

// POST /api/manufacturing/:id/complete — finish MO, update stock
router.post('/:id/complete', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const mo = await prisma.manufacturingOrder.findUnique({
      where: { id: req.params.id },
      include: { moComponents: { include: { product: true } }, product: true, workOrders: true }
    });
    if (!mo) return res.status(404).json({ success: false, message: 'MO not found' });
    if (!['confirmed', 'in_progress'].includes(mo.status)) {
      return res.status(400).json({ success: false, message: 'MO must be confirmed or in progress to complete' });
    }

    // Deduct components from stock
    for (const comp of mo.moComponents) {
      await updateStock(comp.productId, -comp.requiredQty, 'manufacturing_consumption', mo.orderNo, `Component consumed for ${mo.orderNo} — ${comp.product.name}`);
      // Release reserved qty
      await prisma.product.update({ where: { id: comp.productId }, data: { reservedQty: { decrement: comp.requiredQty } } });
      await prisma.moComponent.update({ where: { id: comp.id }, data: { consumedQty: comp.requiredQty } });
    }

    // Add finished goods to stock
    await updateStock(mo.productId, mo.qty, 'manufacturing_output', mo.orderNo, `Finished goods produced by ${mo.orderNo} — ${mo.product.name}`);

    // Complete all pending work orders
    await prisma.workOrder.updateMany({ where: { manufacturingOrderId: mo.id, status: { not: 'completed' } }, data: { status: 'completed', completedAt: new Date() } });

    const completed = await prisma.manufacturingOrder.update({
      where: { id: mo.id },
      data: { status: 'completed', completedAt: new Date() },
      include: { product: true, workOrders: true, moComponents: { include: { product: { select: { name: true } } } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'COMPLETED', model: 'ManufacturingOrder', recordId: mo.id, description: `MO ${mo.orderNo} completed. Added ${mo.qty} × ${mo.product.name} to stock.`, manufacturingOrderId: mo.id });
    await createNotification({ type: 'manufacturing_completed', title: 'Manufacturing Complete', message: `${mo.orderNo}: ${mo.qty} × ${mo.product.name} added to inventory`, reference: mo.orderNo });

    // Check component levels for low stock
    for (const comp of mo.moComponents) {
      const updated = await prisma.product.findUnique({ where: { id: comp.productId } });
      if (updated && updated.onHandQty <= updated.minStockLevel) {
        await createNotificationsForLowStock(updated);
      }
    }

    res.json({ success: true, data: completed });
  } catch (err) { next(err); }
});

module.exports = router;
