const prisma = require('../lib/prisma');

async function createNotification({ type, title, message, reference, userId = null }) {
  if (!userId) {
    const users = await prisma.user.findMany();
    if (users.length > 0) {
      const data = users.map(u => ({ type, title, message, reference, userId: u.id }));
      return prisma.notification.createMany({ data });
    }
  }
  return prisma.notification.create({ data: { type, title, message, reference, userId } });
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
