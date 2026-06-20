const prisma = require('../lib/prisma');
const { updateStock } = require('./stock.service');
const { createAuditLog } = require('./audit.service');
const { createNotification } = require('./notification.service');

/**
 * Core MTO procurement logic.
 * Called when a sales order is confirmed and there's a stock shortage.
 * Automatically creates Manufacturing Order OR Purchase Order based on product config.
 * Uses atomic transactions to prevent race conditions on order numbers.
 */
async function triggerProcurement(product, shortageQty, salesOrderId, salesOrderNo, userId) {
  if (product.procurementRoute === 'manufacturing' && product.canBeManufactured) {
    // Auto-create Manufacturing Order (atomic)
    const bom = await prisma.billOfMaterials.findFirst({
      where: { productId: product.id, isActive: true },
      include: {
        components: { include: { product: true } },
        workOperations: { include: { workCenter: true } }
      }
    });

    const mo = await prisma.$transaction(async (tx) => {
      const lastMo = await tx.manufacturingOrder.findFirst({ orderBy: { orderNo: 'desc' } });
      const lastNum = lastMo ? parseInt(lastMo.orderNo.split('-')[1]) : 0;
      const orderNo = `MO-${String(lastNum + 1).padStart(4, '0')}`;

      return tx.manufacturingOrder.create({
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
    });

    await createAuditLog({ userId, action: 'AUTO_CREATED', model: 'ManufacturingOrder', recordId: mo.id, description: `Auto-created MO ${mo.orderNo} for ${shortageQty} × ${product.name} (triggered by ${salesOrderNo})` });
    await createNotification({ type: 'warning', title: 'Manufacturing Order Created', message: `${mo.orderNo} auto-created for ${shortageQty} × ${product.name} (from ${salesOrderNo})`, reference: mo.orderNo });

    return { type: 'manufacturing_order', orderNo: mo.orderNo, qty: shortageQty, productName: product.name };

  } else {
    // Auto-create Purchase Order (atomic), use preferredVendorName if available
    const vendorName = product.preferredVendorName || 'Auto-Generated — Update Vendor';
    const vendorEmail = product.preferredVendorEmail || null;

    // Enforce minimum purchase quantity based on product config
    const orderQty = Math.max(shortageQty, product.minStockLevel || 0, product.reorderQty || 0);

    const po = await prisma.$transaction(async (tx) => {
      const lastPo = await tx.purchaseOrder.findFirst({ orderBy: { orderNo: 'desc' } });
      const lastNum = lastPo ? parseInt(lastPo.orderNo.split('-')[1]) : 0;
      const orderNo = `PO-${String(lastNum + 1).padStart(4, '0')}`;

      return tx.purchaseOrder.create({
        data: {
          orderNo,
          vendor: vendorName,
          vendorEmail,
          totalAmount: orderQty * product.costPrice,
          isAutoCreated: true,
          salesOrderId,
          items: {
            create: [{
              productId: product.id,
              qty: orderQty,
              receivedQty: 0,
              unitPrice: product.costPrice,
              totalPrice: orderQty * product.costPrice
            }]
          }
        }
      });
    });

    await createAuditLog({ userId, action: 'AUTO_CREATED', model: 'PurchaseOrder', recordId: po.id, description: `Auto-created PO ${po.orderNo} for ${orderQty} × ${product.name} (triggered by ${salesOrderNo})` });
    await createNotification({ type: 'purchase_order_pending', title: 'Purchase Order Created', message: `${po.orderNo} auto-created for ${orderQty} × ${product.name} (from ${salesOrderNo})`, reference: po.orderNo });

    return { type: 'purchase_order', orderNo: po.orderNo, qty: orderQty, productName: product.name };
  }
}

/**
 * Auto-Reorder logic for low stock.
 * Creates a Draft PO for the configured reorderQty.
 * Uses atomic transactions to prevent race conditions on order numbers.
 */
async function triggerAutoReorder(product, userId = 'system') {
  if (!product || product.reorderQty <= 0) return null;
  
  // Check if there is already a pending/draft PO for this product to prevent duplicate reorders
  const existingPending = await prisma.purchaseOrderItem.findFirst({
    where: { 
      productId: product.id, 
      purchaseOrder: { status: { in: ['draft', 'confirmed'] } }
    }
  });
  if (existingPending) return null;

  const vendorName = product.preferredVendorName || 'Auto-Reorder Vendor (Update Required)';
  const vendorEmail = product.preferredVendorEmail || null;

  const po = await prisma.$transaction(async (tx) => {
    const lastPo = await tx.purchaseOrder.findFirst({ orderBy: { orderNo: 'desc' } });
    const lastNum = lastPo ? parseInt(lastPo.orderNo.split('-')[1]) : 0;
    const orderNo = `PO-${String(lastNum + 1).padStart(4, '0')}`;

    return tx.purchaseOrder.create({
      data: {
        orderNo,
        vendor: vendorName,
        vendorEmail,
        totalAmount: product.reorderQty * product.costPrice,
        status: 'draft',
        isAutoCreated: true,
        items: {
          create: [{
            productId: product.id,
            qty: product.reorderQty,
            receivedQty: 0,
            unitPrice: product.costPrice,
            totalPrice: product.reorderQty * product.costPrice
          }]
        }
      }
    });
  });

  if (userId !== 'system') {
    await createAuditLog({ userId, action: 'AUTO_REORDER', model: 'PurchaseOrder', recordId: po.id, description: `Auto-reorder Draft PO ${po.orderNo} created for ${product.reorderQty} × ${product.name} due to low stock.` });
  }
  await createNotification({ type: 'purchase_order_pending', title: 'Auto-Reorder Triggered', message: `Stock for ${product.name} dropped below min level. Draft PO ${po.orderNo} created.`, reference: po.orderNo });

  return po;
}

module.exports = { triggerProcurement, triggerAutoReorder };
