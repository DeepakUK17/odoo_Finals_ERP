/**
 * Seed file for Mini ERP - Shiv Furniture Works
 * Run: node prisma/seed.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Users ──────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const users = await Promise.all([
    prisma.user.upsert({ where: { email: 'admin@shiv.com' }, update: {}, create: { name: 'Shiv Kumar (Admin)', email: 'admin@shiv.com', password: hashedPassword, role: 'admin', position: 'Owner', phone: '+91-9876543210' } }),
    prisma.user.upsert({ where: { email: 'sales@shiv.com' }, update: {}, create: { name: 'Priya Singh', email: 'sales@shiv.com', password: await bcrypt.hash('Sales@123', 12), role: 'sales', position: 'Sales Manager', phone: '+91-9876543211' } }),
    prisma.user.upsert({ where: { email: 'purchase@shiv.com' }, update: {}, create: { name: 'Raj Patel', email: 'purchase@shiv.com', password: await bcrypt.hash('Purchase@123', 12), role: 'purchase', position: 'Purchase Manager', phone: '+91-9876543212' } }),
    prisma.user.upsert({ where: { email: 'mfg@shiv.com' }, update: {}, create: { name: 'Deepak Verma', email: 'mfg@shiv.com', password: await bcrypt.hash('Mfg@123', 12), role: 'manufacturing', position: 'Production Manager', phone: '+91-9876543213' } }),
    prisma.user.upsert({ where: { email: 'inventory@shiv.com' }, update: {}, create: { name: 'Anita Sharma', email: 'inventory@shiv.com', password: await bcrypt.hash('Inv@123', 12), role: 'inventory', position: 'Inventory Manager', phone: '+91-9876543214' } }),
    prisma.user.upsert({ where: { email: 'hr@shiv.com' }, update: {}, create: { name: 'Neha Gupta', email: 'hr@shiv.com', password: await bcrypt.hash('Hr@123', 12), role: 'hr', position: 'HR Manager', phone: '+91-9876543215' } }),
  ]);
  console.log(`✅ Created ${users.length} users`);

  // ── Work Centers ───────────────────────────────────────
  const [assemblyLine, paintFloor, packagingUnit] = await Promise.all([
    prisma.workCenter.upsert({ where: { id: 'wc-assembly' }, update: {}, create: { id: 'wc-assembly', name: 'Assembly Line', description: 'Main assembly area for furniture', capacity: 5 } }),
    prisma.workCenter.upsert({ where: { id: 'wc-paint' }, update: {}, create: { id: 'wc-paint', name: 'Paint Floor', description: 'Painting, sanding, and finishing area', capacity: 3 } }),
    prisma.workCenter.upsert({ where: { id: 'wc-pack' }, update: {}, create: { id: 'wc-pack', name: 'Packaging Unit', description: 'Final packaging and dispatch', capacity: 4 } }),
  ]);
  console.log('✅ Created 3 work centers');

  // ── Component Products ─────────────────────────────────
  const [woodenLegs, tableTop, diningTop, screws, chairFrame, chairCushion, shelfBoard, shelfBracket] = await Promise.all([
    prisma.product.upsert({ where: { name: 'Wooden Legs' }, update: {}, create: { name: 'Wooden Legs', description: 'Strong hardwood legs for furniture', salesPrice: 80, costPrice: 50, onHandQty: 200, reservedQty: 0, minStockLevel: 40, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Table Top (Standard)' }, update: {}, create: { name: 'Table Top (Standard)', description: 'Standard 4x2 ft wooden table top', salesPrice: 300, costPrice: 200, onHandQty: 30, reservedQty: 0, minStockLevel: 8, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Dining Top (Large)' }, update: {}, create: { name: 'Dining Top (Large)', description: 'Large 5x3 ft dining table top', salesPrice: 400, costPrice: 250, onHandQty: 10, reservedQty: 0, minStockLevel: 5, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Screws (M6x30)' }, update: {}, create: { name: 'Screws (M6x30)', description: 'Standard M6 furniture screws', salesPrice: 3, costPrice: 2, onHandQty: 500, reservedQty: 0, minStockLevel: 100, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Chair Frame' }, update: {}, create: { name: 'Chair Frame', description: 'Steel/wood chair base frame', salesPrice: 400, costPrice: 300, onHandQty: 20, reservedQty: 0, minStockLevel: 5, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Chair Cushion' }, update: {}, create: { name: 'Chair Cushion', description: 'High-density foam chair cushion', salesPrice: 200, costPrice: 150, onHandQty: 20, reservedQty: 0, minStockLevel: 5, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Shelf Board' }, update: {}, create: { name: 'Shelf Board', description: 'Plywood shelf board 3x1 ft', salesPrice: 220, costPrice: 180, onHandQty: 40, reservedQty: 0, minStockLevel: 10, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Shelf Bracket' }, update: {}, create: { name: 'Shelf Bracket', description: 'Steel L-bracket for shelf support', salesPrice: 40, costPrice: 30, onHandQty: 80, reservedQty: 0, minStockLevel: 20, productType: 'component', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: false, canBePurchased: true, unit: 'pcs' } }),
  ]);
  console.log('✅ Created 8 component products');

  // ── Finished Products ──────────────────────────────────
  const [woodenTable, officeChair, diningTable, woodenShelf] = await Promise.all([
    prisma.product.upsert({ where: { name: 'Wooden Table' }, update: {}, create: { name: 'Wooden Table', description: 'Premium hardwood office/home table', salesPrice: 2500, costPrice: 1200, onHandQty: 2, reservedQty: 0, minStockLevel: 3, productType: 'finished', procurementType: 'MTO', procurementRoute: 'manufacturing', canBeSold: true, canBePurchased: false, canBeManufactured: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Office Chair' }, update: {}, create: { name: 'Office Chair', description: 'Ergonomic office chair with cushion', salesPrice: 1800, costPrice: 700, onHandQty: 15, reservedQty: 0, minStockLevel: 5, productType: 'finished', procurementType: 'MTS', procurementRoute: 'purchase', canBeSold: true, canBePurchased: true, canBeManufactured: false, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Dining Table' }, update: {}, create: { name: 'Dining Table', description: 'Large 6-seater family dining table', salesPrice: 4500, costPrice: 2000, onHandQty: 5, reservedQty: 0, minStockLevel: 2, productType: 'finished', procurementType: 'MTO', procurementRoute: 'manufacturing', canBeSold: true, canBePurchased: false, canBeManufactured: true, unit: 'pcs' } }),
    prisma.product.upsert({ where: { name: 'Wooden Shelf' }, update: {}, create: { name: 'Wooden Shelf', description: '3-tier wall mounted wooden shelf', salesPrice: 1200, costPrice: 500, onHandQty: 30, reservedQty: 0, minStockLevel: 10, productType: 'finished', procurementType: 'MTO', procurementRoute: 'manufacturing', canBeSold: true, canBePurchased: false, canBeManufactured: true, unit: 'pcs' } }),
  ]);
  console.log('✅ Created 4 finished products');

  // ── Opening Stock Ledger ────────────────────────────────
  const allProducts = [woodenLegs, tableTop, diningTop, screws, chairFrame, chairCushion, shelfBoard, shelfBracket, woodenTable, officeChair, diningTable, woodenShelf];
  for (const p of allProducts) {
    if (p.onHandQty > 0) {
      await prisma.stockLedger.create({
        data: { productId: p.id, type: 'opening_stock', qty: p.onHandQty, balanceQty: p.onHandQty, reference: 'OPENING', description: `Opening stock — ${p.name}` }
      });
    }
  }
  console.log('✅ Created opening stock ledger entries');

  // ── Bill of Materials ──────────────────────────────────

  // Wooden Table BOM
  const woodenTableBom = await prisma.billOfMaterials.create({
    data: {
      productId: woodenTable.id,
      qty: 1,
      reference: 'BOM-WOODEN-TABLE-001',
      components: {
        create: [
          { productId: woodenLegs.id, qty: 4, unit: 'pcs' },
          { productId: tableTop.id, qty: 1, unit: 'pcs' },
          { productId: screws.id, qty: 12, unit: 'pcs' },
        ]
      },
      workOperations: {
        create: [
          { workCenterId: assemblyLine.id, operation: 'Frame Assembly', duration: 2, sequence: 1 },
          { workCenterId: paintFloor.id, operation: 'Sanding & Finishing', duration: 1, sequence: 2 },
          { workCenterId: packagingUnit.id, operation: 'Packaging', duration: 0.5, sequence: 3 },
        ]
      }
    }
  });

  // Dining Table BOM
  const diningTableBom = await prisma.billOfMaterials.create({
    data: {
      productId: diningTable.id,
      qty: 1,
      reference: 'BOM-DINING-TABLE-001',
      components: {
        create: [
          { productId: woodenLegs.id, qty: 4, unit: 'pcs' },
          { productId: diningTop.id, qty: 1, unit: 'pcs' },
          { productId: screws.id, qty: 16, unit: 'pcs' },
        ]
      },
      workOperations: {
        create: [
          { workCenterId: assemblyLine.id, operation: 'Frame Assembly', duration: 2.5, sequence: 1 },
          { workCenterId: paintFloor.id, operation: 'Painting & Lacquering', duration: 1.5, sequence: 2 },
          { workCenterId: packagingUnit.id, operation: 'Packaging', duration: 0.5, sequence: 3 },
        ]
      }
    }
  });

  // Wooden Shelf BOM
  const woodenShelfBom = await prisma.billOfMaterials.create({
    data: {
      productId: woodenShelf.id,
      qty: 1,
      reference: 'BOM-SHELF-001',
      components: {
        create: [
          { productId: shelfBoard.id, qty: 3, unit: 'pcs' },
          { productId: shelfBracket.id, qty: 6, unit: 'pcs' },
          { productId: screws.id, qty: 12, unit: 'pcs' },
        ]
      },
      workOperations: {
        create: [
          { workCenterId: assemblyLine.id, operation: 'Assembly', duration: 1, sequence: 1 },
          { workCenterId: packagingUnit.id, operation: 'Packaging', duration: 0.25, sequence: 2 },
        ]
      }
    }
  });

  console.log('✅ Created 3 Bills of Materials with components and operations');

  // ── Sample Notifications ──────────────────────────────
  await prisma.notification.createMany({
    data: [
      { type: 'low_stock', title: '⚠ Low Stock Alert', message: 'Dining Table: 0 units in stock. Orders may be delayed.', reference: `LOW-${diningTable.id}` },
      { type: 'info', title: '🚀 ERP System Ready', message: 'Shiv Furniture Works ERP is fully operational. All modules loaded.', reference: 'SYSTEM' },
    ]
  });
  console.log('✅ Created sample notifications');

  console.log('\n🎉 Seeding complete!\n');
  console.log('Demo Login Credentials:');
  console.log('─────────────────────────────────────────');
  console.log('Admin:       admin@shiv.com    / Admin@123');
  console.log('Sales:       sales@shiv.com    / Sales@123');
  console.log('Purchase:    purchase@shiv.com / Purchase@123');
  console.log('Mfg:         mfg@shiv.com      / Mfg@123');
  console.log('Inventory:   inventory@shiv.com/ Inv@123');
  console.log('─────────────────────────────────────────');
  console.log('\n💡 Demo Tip: Order a "Dining Table" to see MTO auto-trigger in action!');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
