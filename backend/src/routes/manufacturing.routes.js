const express = require('express');
const router = express.Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createAuditLog } = require('../services/audit.service');
const { updateStock } = require('../services/stock.service');
const { createNotification, createNotificationsForLowStock } = require('../services/notification.service');
const { triggerProcurement, triggerAutoReorder } = require('../services/procurement.service');

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
    const { status, limit, offset } = req.query;
    const where = {};
    if (status) where.status = status;
    
    const take = limit ? parseInt(limit) : 50;
    const skip = offset ? parseInt(offset) : 0;

    const [orders, total] = await Promise.all([
      prisma.manufacturingOrder.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, unit: true } },
          workOrders: { include: { workCenter: true, assignee: { select: { name: true } } } },
          moComponents: { include: { product: { select: { onHandQty: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      }),
      prisma.manufacturingOrder.count({ where })
    ]);
    res.json({ success: true, data: orders, total });
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

    // Auto-fetch BoM if not provided
    let bom = null;
    let resolvedBomId = bomId;
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

    // Atomic order number generation to prevent race conditions
    const mo = await prisma.$transaction(async (tx) => {
      const lastOrder = await tx.manufacturingOrder.findFirst({ orderBy: { orderNo: 'desc' } });
      const lastNum = lastOrder ? parseInt(lastOrder.orderNo.split('-')[1]) : 0;
      const orderNo = `MO-${String(lastNum + 1).padStart(4, '0')}`;

      return tx.manufacturingOrder.create({
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
    });

    await createAuditLog({ userId: req.user.id, action: 'CREATED', model: 'ManufacturingOrder', recordId: mo.id, description: `Manufacturing Order ${mo.orderNo} created for ${qty} × ${mo.product.name}`, manufacturingOrderId: mo.id });
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
    const procurementActions = [];
    
    for (const comp of mo.moComponents) {
      const freeToUse = comp.product.onHandQty - comp.product.reservedQty;
      const exactShortage = Math.max(0, comp.requiredQty - Math.max(0, freeToUse));
      
      if (exactShortage > 0) {
        shortages.push({ name: comp.product.name, required: comp.requiredQty, available: Math.max(0, freeToUse) });
        // Order the exact missing amount to fulfill this MO
        const action = await triggerProcurement(comp.product, exactShortage, mo.id, mo.orderNo, req.user.id);
        procurementActions.push(action);
      }
      
      // ALWAYS reserve to ensure completion decrement balances perfectly
      const updatedProd = await prisma.product.update({ where: { id: comp.productId }, data: { reservedQty: { increment: comp.requiredQty } } });
      
      // Check for min-max auto reorder using true availability (onHand - reserved)
      const trueFreeToUse = updatedProd.onHandQty - updatedProd.reservedQty;
      if (trueFreeToUse <= updatedProd.minStockLevel) {
        await triggerAutoReorder(updatedProd, req.user.id);
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
    const mo = await prisma.manufacturingOrder.findUnique({
      where: { id: req.params.id },
      include: { moComponents: { include: { product: true } } }
    });
    if (!mo) return res.status(404).json({ success: false, message: 'MO not found' });

    // Ensure components are physically available before starting work
    for (const comp of mo.moComponents) {
      if (comp.product.onHandQty < comp.requiredQty) {
        return res.status(400).json({ success: false, message: `Cannot start: Insufficient physical stock for ${comp.product.name} (Need: ${comp.requiredQty}, Have: ${comp.product.onHandQty}). Receive pending Purchase Orders first.` });
      }
    }

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

    const { consumptions } = req.body || {};

    // Validate physical stock before deducting
    for (const comp of mo.moComponents) {
      const custom = consumptions?.find(c => c.componentId === comp.id);
      const actualConsumed = custom && custom.consumedQty !== undefined ? Number(custom.consumedQty) : comp.requiredQty;
      
      if (comp.product.onHandQty < actualConsumed) {
        return res.status(400).json({ success: false, message: `Cannot complete MO: Insufficient physical stock for ${comp.product.name} (Need: ${actualConsumed}, Have: ${comp.product.onHandQty}). Receive pending Purchase Orders first.` });
      }
    }

    // Deduct components from stock
    for (const comp of mo.moComponents) {
      const custom = consumptions?.find(c => c.componentId === comp.id);
      const actualConsumed = custom && custom.consumedQty !== undefined ? Number(custom.consumedQty) : comp.requiredQty;

      await updateStock(comp.productId, -actualConsumed, 'manufacturing_consumption', mo.orderNo, `Component consumed for ${mo.orderNo} — ${comp.product.name}`);
      // Release reserved qty. We use Math.max to prevent it from ever dropping below 0, just in case of dirty historical data.
      await prisma.product.update({ 
        where: { id: comp.productId }, 
        data: { reservedQty: Math.max(0, comp.product.reservedQty - comp.requiredQty) } 
      });
      await prisma.moComponent.update({ where: { id: comp.id }, data: { consumedQty: actualConsumed } });
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

    res.json({ success: true, data: completed });
  } catch (err) { next(err); }
});

// POST /api/manufacturing/:id/cancel
router.post('/:id/cancel', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const mo = await prisma.manufacturingOrder.findUnique({
      where: { id: req.params.id },
      include: { moComponents: { include: { product: true } }, product: true }
    });
    if (!mo) return res.status(404).json({ success: false, message: 'MO not found' });
    if (mo.status === 'completed') return res.status(400).json({ success: false, message: 'Cannot cancel a completed manufacturing order' });
    if (mo.status === 'cancelled') return res.status(400).json({ success: false, message: 'Order already cancelled' });

    // Release reserved component quantities if MO was confirmed
    if (['confirmed', 'in_progress'].includes(mo.status)) {
      for (const comp of mo.moComponents) {
        await prisma.product.update({
          where: { id: comp.productId },
          data: { reservedQty: { decrement: comp.requiredQty } }
        });
      }
    }

    const cancelled = await prisma.manufacturingOrder.update({
      where: { id: mo.id },
      data: { status: 'cancelled' },
      include: { product: true, moComponents: { include: { product: { select: { name: true } } } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CANCELLED', model: 'ManufacturingOrder', recordId: mo.id, description: `MO ${mo.orderNo} cancelled — reserved components released`, manufacturingOrderId: mo.id });
    res.json({ success: true, data: cancelled });
  } catch (err) { next(err); }
});

module.exports = router;
