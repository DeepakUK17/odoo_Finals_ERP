const prisma = require('../lib/prisma');
const { updateStock } = require('./stock.service');
const { createAuditLog } = require('./audit.service');
const { createNotification } = require('./notification.service');

/**
 * Core MTO procurement logic.
 * Called when a sales order is confirmed and there's a stock shortage.
 * Automatically creates Manufacturing Order OR Purchase Order based on product config.
 */
async function triggerProcurement(product, shortageQty, salesOrderId, salesOrderNo, userId) {
  const lastMo = await prisma.manufacturingOrder.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastPo = await prisma.purchaseOrder.findFirst({ orderBy: { createdAt: 'desc' } });

  if (product.procurementRoute === 'manufacturing' && product.canBeManufactured) {
    // Auto-create Manufacturing Order
    const lastNum = lastMo ? parseInt(lastMo.orderNo.split('-')[1]) : 0;
    const orderNo = `MO-${String(lastNum + 1).padStart(4, '0')}`;

    // Find BoM for this product
    const bom = await prisma.billOfMaterials.findFirst({
      where: { productId: product.id, isActive: true },
      include: {
        components: { include: { product: true } },
        workOperations: { include: { workCenter: true } }
      }
    });

    const mo = await prisma.manufacturingOrder.create({
      data: {
        orderNo,
        productId: product.id,
        bomId: bom?.id || null,
        qty: shortageQty,
        isAutoCreated: true,
        salesOrderId,
        moComponents: bom ? {
          create: bom.components.map(c => ({
            productId: c.productId,
            requiredQty: c.qty * shortageQty,
            consumedQty: 0
          }))
        } : undefined,
        workOrders: bom ? {
          create: bom.workOperations.map(op => ({
            workCenterId: op.workCenterId,
            operation: op.operation,
            duration: op.duration,
            sequence: op.sequence,
            status: 'pending'
          }))
        } : undefined
      }
    });

    await createAuditLog({ userId, action: 'AUTO_CREATED', model: 'ManufacturingOrder', recordId: mo.id, description: `Auto-created MO ${orderNo} for ${shortageQty} × ${product.name} (triggered by ${salesOrderNo})` });
    await createNotification({ type: 'warning', title: 'Manufacturing Order Created', message: `${orderNo} auto-created for ${shortageQty} × ${product.name} (from ${salesOrderNo})`, reference: orderNo });

    return { type: 'manufacturing_order', orderNo, qty: shortageQty, productName: product.name };

  } else {
    // Auto-create Purchase Order
    const lastNum = lastPo ? parseInt(lastPo.orderNo.split('-')[1]) : 0;
    const orderNo = `PO-${String(lastNum + 1).padStart(4, '0')}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        orderNo,
        vendor: 'Auto-Generated Vendor',
        totalAmount: shortageQty * product.costPrice,
        isAutoCreated: true,
        salesOrderId,
        items: {
          create: [{
            productId: product.id,
            qty: shortageQty,
            receivedQty: 0,
            unitPrice: product.costPrice,
            totalPrice: shortageQty * product.costPrice
          }]
        }
      }
    });

    await createAuditLog({ userId, action: 'AUTO_CREATED', model: 'PurchaseOrder', recordId: po.id, description: `Auto-created PO ${orderNo} for ${shortageQty} × ${product.name} (triggered by ${salesOrderNo})` });
    await createNotification({ type: 'purchase_order_pending', title: 'Purchase Order Created', message: `${orderNo} auto-created for ${shortageQty} × ${product.name} (from ${salesOrderNo})`, reference: orderNo });

    return { type: 'purchase_order', orderNo, qty: shortageQty, productName: product.name };
  }
}

module.exports = { triggerProcurement };
