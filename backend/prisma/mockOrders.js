const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding mock orders and data...');

  // Get some products and users
  const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
  const products = await prisma.product.findMany();
  
  if (products.length === 0) {
    console.log('No products found. Please run seed.js first.');
    return;
  }

  const finishedGoods = products.filter(p => p.productType === 'finished');
  const components = products.filter(p => p.productType === 'component');

  // --- 1. MOCK SALES ORDERS ---
  console.log('Creating Sales Orders...');
  await prisma.salesOrder.create({
    data: {
      orderNo: 'SO-1001',
      customer: 'Acme Corp',
      customerEmail: 'contact@acmecorp.com',
      status: 'confirmed',
      totalAmount: finishedGoods[0].salesPrice * 5,
      createdById: admin.id,
      items: {
        create: [
          {
            productId: finishedGoods[0].id,
            qty: 5,
            unitPrice: finishedGoods[0].salesPrice,
            totalPrice: finishedGoods[0].salesPrice * 5
          }
        ]
      }
    }
  });

  await prisma.salesOrder.create({
    data: {
      orderNo: 'SO-1002',
      customer: 'Global Furnishings',
      status: 'partially_delivered',
      totalAmount: finishedGoods[1].salesPrice * 10,
      createdById: admin.id,
      items: {
        create: [
          {
            productId: finishedGoods[1].id,
            qty: 10,
            deliveredQty: 4,
            unitPrice: finishedGoods[1].salesPrice,
            totalPrice: finishedGoods[1].salesPrice * 10
          }
        ]
      }
    }
  });

  // --- 2. MOCK PURCHASE ORDERS ---
  console.log('Creating Purchase Orders...');
  await prisma.purchaseOrder.create({
    data: {
      orderNo: 'PO-2001',
      vendor: 'Wood Suppliers Inc',
      status: 'confirmed',
      totalAmount: components[0].costPrice * 100,
      createdById: admin.id,
      items: {
        create: [
          {
            productId: components[0].id,
            qty: 100,
            unitPrice: components[0].costPrice,
            totalPrice: components[0].costPrice * 100
          }
        ]
      }
    }
  });

  await prisma.purchaseOrder.create({
    data: {
      orderNo: 'PO-2002',
      vendor: 'Steel Works LLC',
      status: 'partially_received',
      totalAmount: components[1].costPrice * 50,
      createdById: admin.id,
      items: {
        create: [
          {
            productId: components[1].id,
            qty: 50,
            receivedQty: 25,
            unitPrice: components[1].costPrice,
            totalPrice: components[1].costPrice * 50
          }
        ]
      }
    }
  });

  // --- 3. MOCK MANUFACTURING ORDERS ---
  console.log('Creating Manufacturing Orders...');
  await prisma.manufacturingOrder.create({
    data: {
      orderNo: 'MO-3001',
      productId: finishedGoods[0].id,
      qty: 20,
      status: 'in_progress',
      scheduledDate: new Date(),
    }
  });

  // --- 4. MOCK AUDIT LOGS & NOTIFICATIONS ---
  console.log('Creating Audit Logs & Notifications...');
  await prisma.auditLog.createMany({
    data: [
      { action: 'LOGIN', model: 'User', description: 'Admin logged in', userId: admin.id },
      { action: 'CONFIRM', model: 'SalesOrder', description: 'Confirmed SO-1001', userId: admin.id },
      { action: 'CREATE', model: 'PurchaseOrder', description: 'Created PO-2001', userId: admin.id },
      { action: 'UPDATE', model: 'ManufacturingOrder', description: 'Started MO-3001', userId: admin.id }
    ]
  });

  await prisma.notification.createMany({
    data: [
      { type: 'low_stock', title: 'Low Stock Alert', message: 'Wood is running low!', userId: admin.id },
      { type: 'sales_order_confirmed', title: 'New Sale', message: 'SO-1001 was confirmed.', userId: admin.id },
      { type: 'info', title: 'System Update', message: 'ERP system successfully deployed.' }
    ]
  });

  console.log('✅ Mock data seeded completely!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
