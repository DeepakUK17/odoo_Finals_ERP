const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randomDate(startDaysAgo, endDaysAgo) {
  const date = new Date();
  const daysAgo = Math.random() * (startDaysAgo - endDaysAgo) + endDaysAgo;
  date.setDate(date.getDate() - daysAgo);
  return date;
}

async function main() {
  console.log('Generating extensive mock data for the last 3 days...');

  // Get users and products
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  const salesUser = await prisma.user.findFirst({ where: { role: 'sales' } }) || admin;
  const products = await prisma.product.findMany();

  if (products.length === 0) {
    console.log('No products found. Run seed.js first.');
    return;
  }

  const finishedGoods = products.filter(p => p.productType === 'finished');
  const components = products.filter(p => p.productType === 'component');

  // Customers & Vendors
  const customers = [
    { name: 'Acme Corp', email: 'contact@acmecorp.com', phone: '555-0101' },
    { name: 'Global Furnishings', email: 'sales@globalfurn.com', phone: '555-0202' },
    { name: 'City Hotels Group', email: 'procurement@cityhotels.com', phone: '555-0303' },
    { name: 'Tech Startups LLC', email: 'office@techstart.com', phone: '555-0404' }
  ];

  const vendors = [
    { name: 'Wood Suppliers Inc', email: 'orders@woodinc.com', phone: '555-1101' },
    { name: 'Steel Works LLC', email: 'sales@steelworks.com', phone: '555-1102' },
    { name: 'Fabrics & More', email: 'hello@fabricsmore.com', phone: '555-1103' }
  ];

  // --- MOCK SALES ORDERS (Last 3 days) ---
  console.log('Creating Sales Orders...');
  for (let i = 1; i <= 15; i++) {
    const cust = customers[i % customers.length];
    const prod = finishedGoods[i % finishedGoods.length];
    const qty = Math.floor(Math.random() * 10) + 1;
    const createdAt = randomDate(3, 0); // between 3 days ago and today
    
    // Mix of statuses
    const statuses = ['draft', 'confirmed', 'fully_delivered', 'partially_delivered'];
    const status = statuses[i % 4];

    await prisma.salesOrder.create({
      data: {
        orderNo: `SO-10${10 + i}`,
        customer: cust.name,
        customerEmail: cust.email,
        customerPhone: cust.phone,
        status: status,
        totalAmount: prod.salesPrice * qty,
        createdById: salesUser.id,
        createdAt: createdAt,
        confirmedAt: status !== 'draft' ? new Date(createdAt.getTime() + 3600000) : null,
        deliveredAt: status === 'fully_delivered' ? new Date(createdAt.getTime() + 86400000) : null,
        items: {
          create: [{
            productId: prod.id,
            qty: qty,
            deliveredQty: status === 'fully_delivered' ? qty : (status === 'partially_delivered' ? Math.floor(qty/2) : 0),
            unitPrice: prod.salesPrice,
            totalPrice: prod.salesPrice * qty
          }]
        }
      }
    });
  }

  // --- MOCK PURCHASE ORDERS ---
  console.log('Creating Purchase Orders...');
  for (let i = 1; i <= 10; i++) {
    const vend = vendors[i % vendors.length];
    const comp = components[i % components.length];
    const qty = (Math.floor(Math.random() * 5) + 1) * 50; // 50 to 250
    const createdAt = randomDate(3, 0);
    const statuses = ['draft', 'confirmed', 'fully_received', 'partially_received'];
    const status = statuses[i % 4];

    await prisma.purchaseOrder.create({
      data: {
        orderNo: `PO-20${10 + i}`,
        vendor: vend.name,
        vendorEmail: vend.email,
        vendorPhone: vend.phone,
        status: status,
        totalAmount: comp.costPrice * qty,
        createdById: admin.id,
        createdAt: createdAt,
        confirmedAt: status !== 'draft' ? new Date(createdAt.getTime() + 3600000) : null,
        receivedAt: status === 'fully_received' ? new Date(createdAt.getTime() + 86400000) : null,
        items: {
          create: [{
            productId: comp.id,
            qty: qty,
            receivedQty: status === 'fully_received' ? qty : (status === 'partially_received' ? Math.floor(qty/2) : 0),
            unitPrice: comp.costPrice,
            totalPrice: comp.costPrice * qty
          }]
        }
      }
    });
  }

  // --- MOCK MANUFACTURING ORDERS ---
  console.log('Creating Manufacturing Orders...');
  for (let i = 1; i <= 8; i++) {
    const prod = finishedGoods[i % finishedGoods.length];
    const qty = Math.floor(Math.random() * 20) + 5;
    const createdAt = randomDate(2, 0);
    const statuses = ['draft', 'confirmed', 'in_progress', 'completed'];
    const status = statuses[i % 4];

    await prisma.manufacturingOrder.create({
      data: {
        orderNo: `MO-30${10 + i}`,
        productId: prod.id,
        qty: qty,
        status: status,
        createdAt: createdAt,
        scheduledDate: new Date(createdAt.getTime() + 86400000),
        completedAt: status === 'completed' ? new Date(createdAt.getTime() + 172800000) : null
      }
    });
  }

  // --- STOCK ADJUSTMENTS ---
  // To make the charts look good, let's inject some raw stock ledger entries to show movement
  console.log('Creating Stock Ledger entries...');
  for (let i = 1; i <= 20; i++) {
    const prod = products[i % products.length];
    const isOut = i % 2 === 0;
    const qty = isOut ? -10 : 20;
    await prisma.stockLedger.create({
      data: {
        productId: prod.id,
        type: isOut ? 'sale_delivery' : 'purchase_receipt',
        qty: qty,
        balanceQty: prod.onHandQty + qty,
        reference: isOut ? `SO-10${10+i}` : `PO-20${10+i}`,
        createdAt: randomDate(3, 0)
      }
    });
    // Update product on hand
    await prisma.product.update({
      where: { id: prod.id },
      data: { onHandQty: { increment: qty } }
    });
  }

  // --- MOCK AUDIT LOGS ---
  console.log('Creating Audit Logs...');
  for (let i = 0; i < 20; i++) {
    await prisma.auditLog.create({
      data: {
        action: ['CREATE', 'UPDATE', 'CONFIRM', 'DELIVER'][i % 4],
        model: ['SalesOrder', 'PurchaseOrder', 'ManufacturingOrder', 'Product'][i % 4],
        description: `System activity ${i}`,
        userId: admin.id,
        timestamp: randomDate(3, 0)
      }
    });
  }

  console.log('✅ Extensive 3-day mock data seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
