const prisma = require('./src/lib/prisma');

async function main() {
  // 1. Fix salesOrderItems
  const allSalesItems = await prisma.salesOrderItem.findMany({ include: { salesOrder: true } });
  for (const item of allSalesItems) {
    if (item.salesOrder.status === 'draft' || item.salesOrder.status === 'cancelled') {
      await prisma.salesOrderItem.update({ where: { id: item.id }, data: { reservedQty: 0 } });
    } else {
      const pending = Math.max(0, item.qty - item.deliveredQty);
      await prisma.salesOrderItem.update({ where: { id: item.id }, data: { reservedQty: pending } });
    }
  }

  // 2. Recalculate product reservations
  const products = await prisma.product.findMany({ 
    include: { 
      salesOrderItems: true,
      moComponents: { include: { manufacturingOrder: true } }
    } 
  });

  for (const p of products) {
    let salesReserved = p.salesOrderItems.reduce((acc, item) => acc + item.reservedQty, 0);
    
    // Calculate manufacturing reservations (components needed for confirmed/in-progress MOs)
    let moReserved = p.moComponents.reduce((acc, comp) => {
      if (['confirmed', 'in_progress'].includes(comp.manufacturingOrder.status)) {
        return acc + comp.requiredQty;
      }
      return acc;
    }, 0);

    const totalReserved = Math.max(0, salesReserved + moReserved);

    await prisma.product.update({ where: { id: p.id }, data: { reservedQty: totalReserved } });
    console.log(`Set ${p.name} reservedQty to ${totalReserved}`);
  }
  
  console.log("Fixed historical reservations!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
