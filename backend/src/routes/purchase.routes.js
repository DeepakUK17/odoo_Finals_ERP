const express = require('express');
const router = express.Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createAuditLog } = require('../services/audit.service');
const { updateStock } = require('../services/stock.service');
const { createNotification } = require('../services/notification.service');

const poSchema = z.object({
  vendor: z.string().min(1),
  vendorEmail: z.string().email().or(z.literal('')).optional(),
  vendorPhone: z.string().or(z.literal('')).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    qty: z.number().positive(),
    unitPrice: z.number().min(0)
  })).min(1)
});

// GET /api/purchase
router.get('/', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const where = {};
    if (status) where.status = status;
    
    const take = limit ? parseInt(limit) : 50;
    const skip = offset ? parseInt(offset) : 0;

    const [orders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: { items: { include: { product: { select: { id: true, name: true, unit: true } } } }, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip
      }),
      prisma.purchaseOrder.count({ where })
    ]);
    res.json({ success: true, data: orders, total });
  } catch (err) { next(err); }
});

// GET /api/purchase/:id
router.get('/:id', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true } },
        createdBy: { select: { name: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, include: { user: { select: { name: true } } } }
      }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Purchase order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// POST /api/purchase
router.post('/', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const { vendor, vendorEmail, vendorPhone, notes, items } = poSchema.parse(req.body);
    const orderItems = items.map(i => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice, totalPrice: i.qty * i.unitPrice, receivedQty: 0 }));
    const totalAmount = orderItems.reduce((s, i) => s + i.totalPrice, 0);

    // Atomic order number generation to prevent race conditions
    const order = await prisma.$transaction(async (tx) => {
      const lastOrder = await tx.purchaseOrder.findFirst({ orderBy: { orderNo: 'desc' } });
      const lastNum = lastOrder ? parseInt(lastOrder.orderNo.split('-')[1]) : 0;
      const orderNo = `PO-${String(lastNum + 1).padStart(4, '0')}`;

      return tx.purchaseOrder.create({
        data: { orderNo, vendor, vendorEmail, vendorPhone, notes, totalAmount, createdById: req.user.id, items: { create: orderItems } },
        include: { items: { include: { product: true } } }
      });
    });

    await createAuditLog({ userId: req.user.id, action: 'CREATED', model: 'PurchaseOrder', recordId: order.id, description: `Purchase Order ${order.orderNo} created — vendor: ${vendor} (Total: ₹${totalAmount.toLocaleString('en-IN')})`, purchaseOrderId: order.id });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// POST /api/purchase/:id/confirm
router.post('/:id/confirm', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id }, include: { items: { include: { product: true } } } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'draft') return res.status(400).json({ success: false, message: 'Order already confirmed' });

    const confirmedOrder = await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
      include: { items: { include: { product: true } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CONFIRMED', model: 'PurchaseOrder', recordId: order.id, description: `Purchase Order ${order.orderNo} confirmed`, purchaseOrderId: order.id });
    await createNotification({ type: 'info', title: 'PO Confirmed', message: `${order.orderNo} confirmed with ${order.vendor}`, reference: order.orderNo });

    res.json({ success: true, data: confirmedOrder });
  } catch (err) { next(err); }
});

// POST /api/purchase/:id/receive
router.post('/:id/receive', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const { receipts } = req.body; // [{ itemId, receivedQty }]
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!['confirmed', 'partially_received'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order must be confirmed to receive' });
    }

    for (const r of receipts) {
      const item = order.items.find(i => i.id === r.itemId);
      if (!item) continue;
      const maxReceivable = item.qty - item.receivedQty;
      const toReceive = Math.min(r.receivedQty, maxReceivable);
      if (toReceive <= 0) continue;

      await prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { receivedQty: { increment: toReceive } } });
      await updateStock(item.productId, toReceive, 'purchase_receipt', order.orderNo, `Receipt for ${order.orderNo} — ${item.product.name}`);
      await createAuditLog({ userId: req.user.id, action: 'RECEIVED', model: 'PurchaseOrder', recordId: order.id, description: `Received ${toReceive} × ${item.product.name} for ${order.orderNo}`, purchaseOrderId: order.id });
    }

    const updated = await prisma.purchaseOrder.findUnique({ where: { id: order.id }, include: { items: true } });
    const allReceived = updated.items.every(i => i.receivedQty >= i.qty);
    const anyReceived = updated.items.some(i => i.receivedQty > 0);
    const newStatus = allReceived ? 'fully_received' : anyReceived ? 'partially_received' : 'confirmed';

    const final = await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: newStatus, ...(allReceived && { receivedAt: new Date() }) },
      include: { items: { include: { product: true } } }
    });

    if (allReceived) {
      await createNotification({ type: 'delivery_done', title: 'Purchase Receipt Complete', message: `${order.orderNo} fully received from ${order.vendor}`, reference: order.orderNo });
    }

    res.json({ success: true, data: final });
  } catch (err) { next(err); }
});

// PUT /api/purchase/:id — update vendor info on draft
router.put('/:id', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const { vendor, vendorEmail, vendorPhone, notes } = req.body;
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order || order.status !== 'draft') return res.status(400).json({ success: false, message: 'Can only edit draft orders' });
    const updated = await prisma.purchaseOrder.update({ where: { id: req.params.id }, data: { vendor, vendorEmail, vendorPhone, notes }, include: { items: { include: { product: true } } } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// POST /api/purchase/:id/cancel
router.post('/:id/cancel', authMiddleware, requireRole('admin', 'purchase'), async (req, res, next) => {
  try {
    const order = await prisma.purchaseOrder.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'fully_received') return res.status(400).json({ success: false, message: 'Cannot cancel a fully received order' });
    if (order.status === 'cancelled') return res.status(400).json({ success: false, message: 'Order already cancelled' });

    const cancelled = await prisma.purchaseOrder.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
      include: { items: { include: { product: true } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CANCELLED', model: 'PurchaseOrder', recordId: order.id, description: `Purchase Order ${order.orderNo} cancelled`, purchaseOrderId: order.id });
    res.json({ success: true, data: cancelled });
  } catch (err) { next(err); }
});

module.exports = router;
