const prisma = require('../lib/prisma');

async function createAuditLog({ userId, action, model, recordId, description, oldValues, newValues, salesOrderId, purchaseOrderId, manufacturingOrderId, productId }) {
  return prisma.auditLog.create({
    data: { userId, action, model, recordId, description, oldValues, newValues, salesOrderId, purchaseOrderId, manufacturingOrderId, productId }
  });
}

module.exports = { createAuditLog };
