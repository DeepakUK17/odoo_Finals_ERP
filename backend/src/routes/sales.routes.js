const express = require('express');
const router = express.Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createAuditLog } = require('../services/audit.service');
const { triggerProcurement } = require('../services/procurement.service');
const { updateStock } = require('../services/stock.service');
const { createNotification } = require('../services/notification.service');

let soCounter = 1;
const generateOrderNo = () => {
  const no = String(soCounter++).padStart(4, '0');
  return `SO-${no}`;
};

const soSchema = z.object({
  customer: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    qty: z.number().positive(),
    unitPrice: z.number().min(0)
  })).min(1)
});

// GET /api/sales
router.get('/', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const orders = await prisma.salesOrder.findMany({
      where,
      include: { items: { include: { product: { select: { id: true, name: true, unit: true } } } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (err) { next(err); }
});

// GET /api/sales/:id
router.get('/:id', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true } },
        createdBy: { select: { name: true, email: true } },
        auditLogs: { orderBy: { timestamp: 'desc' }, include: { user: { select: { name: true } } } }
      }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Sales order not found' });
    res.json({ success: true, data: order });
  } catch (err) { next(err); }
});

// POST /api/sales — create draft
router.post('/', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const { customer, customerEmail, customerPhone, notes, items } = soSchema.parse(req.body);

    // Build items with totalPrice
    const orderItems = items.map(i => ({
      productId: i.productId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      totalPrice: i.qty * i.unitPrice,
      reservedQty: 0,
      deliveredQty: 0
    }));
    const totalAmount = orderItems.reduce((s, i) => s + i.totalPrice, 0);

    // Find next order number
    const lastOrder = await prisma.salesOrder.findFirst({ orderBy: { createdAt: 'desc' } });
    const lastNum = lastOrder ? parseInt(lastOrder.orderNo.split('-')[1]) : 0;
    const orderNo = `SO-${String(lastNum + 1).padStart(4, '0')}`;

    const order = await prisma.salesOrder.create({
      data: {
        orderNo,
        customer,
        customerEmail,
        customerPhone,
        notes,
        totalAmount,
        createdById: req.user.id,
        items: { create: orderItems }
      },
      include: { items: { include: { product: true } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CREATED', model: 'SalesOrder', recordId: order.id, description: `Sales Order ${orderNo} created for ${customer}`, salesOrderId: order.id });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// POST /api/sales/:id/confirm — THE CORE LOGIC (MTS/MTO)
router.post('/:id/confirm', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'draft') return res.status(400).json({ success: false, message: `Cannot confirm order in ${order.status} status` });

    const procurementActions = [];

    // Process each item
    for (const item of order.items) {
      const product = item.product;
      const freeToUse = Math.max(0, product.onHandQty - product.reservedQty);

      if (product.procurementType === 'MTS' && freeToUse >= item.qty) {
        // MTS with sufficient stock → just reserve
        await prisma.product.update({
          where: { id: product.id },
          data: { reservedQty: { increment: item.qty } }
        });
        await prisma.salesOrderItem.update({
          where: { id: item.id },
          data: { reservedQty: item.qty }
        });
      } else {
        // MTO OR insufficient MTS stock → trigger procurement for shortage
        const shortage = item.qty - freeToUse;
        const canReserveNow = Math.max(0, freeToUse);

        if (canReserveNow > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { reservedQty: { increment: canReserveNow } }
          });
          await prisma.salesOrderItem.update({
            where: { id: item.id },
            data: { reservedQty: canReserveNow }
          });
        }

        if (shortage > 0) {
          const result = await triggerProcurement(product, shortage, order.id, order.orderNo, req.user.id);
          procurementActions.push(result);
        }
      }
    }

    // Update order status
    const confirmedOrder = await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
      include: { items: { include: { product: true } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CONFIRMED', model: 'SalesOrder', recordId: order.id, description: `Sales Order ${order.orderNo} confirmed. ${procurementActions.length > 0 ? `Auto-triggered ${procurementActions.length} procurement action(s)` : 'Delivered from stock'}`, salesOrderId: order.id });

    await createNotification({ type: 'sales_order_confirmed', title: 'Sales Order Confirmed', message: `${order.orderNo} confirmed for ${order.customer}`, reference: order.orderNo });

    res.json({ success: true, data: confirmedOrder, procurementActions });
  } catch (err) { next(err); }
});

// POST /api/sales/:id/deliver — deliver items
router.post('/:id/deliver', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const { deliveries } = req.body; // [{ itemId, deliveredQty }]
    const order = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (!['confirmed', 'partially_delivered'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order must be confirmed before delivery' });
    }

    for (const d of deliveries) {
      const item = order.items.find(i => i.id === d.itemId);
      if (!item) continue;
      const maxDeliverable = item.qty - item.deliveredQty;
      const toDeliver = Math.min(d.deliveredQty, maxDeliverable);
      if (toDeliver <= 0) continue;

      // Update item
      await prisma.salesOrderItem.update({
        where: { id: item.id },
        data: {
          deliveredQty: { increment: toDeliver },
          reservedQty: { decrement: toDeliver }
        }
      });

      // Deduct from stock
      await updateStock(item.productId, -toDeliver, 'sale_delivery', order.orderNo, `Delivery for ${order.orderNo} — ${item.product.name}`);

      await createAuditLog({ userId: req.user.id, action: 'DELIVERED', model: 'SalesOrder', recordId: order.id, description: `Delivered ${toDeliver} × ${item.product.name} for ${order.orderNo}`, salesOrderId: order.id });
    }

    // Recheck status
    const updated = await prisma.salesOrder.findUnique({
      where: { id: order.id },
      include: { items: true }
    });
    const allDelivered = updated.items.every(i => i.deliveredQty >= i.qty);
    const anyDelivered = updated.items.some(i => i.deliveredQty > 0);

    const newStatus = allDelivered ? 'fully_delivered' : anyDelivered ? 'partially_delivered' : 'confirmed';
    const final = await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: newStatus, ...(allDelivered && { deliveredAt: new Date() }) },
      include: { items: { include: { product: true } } }
    });

    if (allDelivered) {
      await createNotification({ type: 'delivery_done', title: 'Delivery Complete', message: `${order.orderNo} fully delivered to ${order.customer}`, reference: order.orderNo });
    }

    res.json({ success: true, data: final });
  } catch (err) { next(err); }
});

// POST /api/sales/:id/cancel
router.post('/:id/cancel', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const order = await prisma.salesOrder.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true } } }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status === 'fully_delivered') return res.status(400).json({ success: false, message: 'Cannot cancel a fully delivered order' });

    // Release reserved quantities
    for (const item of order.items) {
      if (item.reservedQty > 0) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { reservedQty: { decrement: item.reservedQty } }
        });
      }
    }

    const cancelled = await prisma.salesOrder.update({
      where: { id: order.id },
      data: { status: 'cancelled' },
      include: { items: { include: { product: true } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'CANCELLED', model: 'SalesOrder', recordId: order.id, description: `Sales Order ${order.orderNo} cancelled — reserved quantities released`, salesOrderId: order.id });
    res.json({ success: true, data: cancelled });
  } catch (err) { next(err); }
});

module.exports = router;
