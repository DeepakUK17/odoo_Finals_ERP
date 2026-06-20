const prisma = require('../lib/prisma');
const socketManager = require('../lib/socket');

async function createNotification({ type, title, message, reference, userId = null }) {
  let result;
  if (!userId) {
    const users = await prisma.user.findMany();
    if (users.length > 0) {
      const data = users.map(u => ({ type, title, message, reference, userId: u.id }));
      result = await prisma.notification.createMany({ data });
      socketManager.emitNewNotification({ type, title, message, reference });
      return result;
    }
  }
  result = await prisma.notification.create({ data: { type, title, message, reference, userId } });
  socketManager.emitNewNotification(result);
  return result;
}

async function createNotificationsForLowStock(product) {
  const existing = await prisma.notification.findFirst({
    where: { reference: `LOW-${product.id}`, isRead: false }
  });
  if (!existing) {
    await createNotification({
      type: 'low_stock',
      title: '⚠ Low Stock Alert',
      message: `${product.name}: only ${product.onHandQty} ${product.unit} remaining (min: ${product.minStockLevel})`,
      reference: `LOW-${product.id}`
    });
  }
}

module.exports = { createNotification, createNotificationsForLowStock };
