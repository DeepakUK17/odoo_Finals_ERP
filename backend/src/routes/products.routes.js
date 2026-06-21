const express = require('express');
const router = express.Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createAuditLog } = require('../services/audit.service');
const { createNotificationsForLowStock } = require('../services/notification.service');

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  salesPrice: z.number().min(0),
  costPrice: z.number().min(0),
  onHandQty: z.number().min(0).default(0),
  minStockLevel: z.number().min(0).default(10),
  reorderQty: z.number().min(0).default(0),
  productType: z.enum(['finished', 'component']).default('finished'),
  procurementType: z.enum(['MTS', 'MTO']).default('MTS'),
  procurementRoute: z.enum(['manufacturing', 'purchase']).default('purchase'),
  canBeSold: z.boolean().default(true),
  canBePurchased: z.boolean().default(true),
  canBeManufactured: z.boolean().default(false),
  unit: z.string().default('units'),
  preferredVendorName: z.string().optional().nullable(),
  preferredVendorEmail: z.string().email().optional().nullable().or(z.literal(''))
});

// GET /api/products
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { search, type, procurement } = req.query;
    const where = { isActive: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (type) where.productType = type;
    if (procurement) where.procurementType = procurement;

    const products = await prisma.product.findMany({
      where,
      orderBy: [
        { name: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Deduplicate by name, preferring the primary ones
    const uniqueProducts = [];
    const seen = new Set();
    for (const p of products) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        uniqueProducts.push({
          ...p,
          freeToUseQty: Math.max(0, p.onHandQty - p.reservedQty)
        });
      }
    }

    res.json({
      success: true,
      data: uniqueProducts
    });
  } catch (err) { next(err); }
});

// GET /api/products/low-stock
router.get('/low-stock', authMiddleware, async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        onHandQty: { lte: prisma.product.fields.minStockLevel }
      }
    });
    // Manual filter since Prisma doesn't support column comparison directly
    const all = await prisma.product.findMany({ where: { isActive: true } });
    const lowStock = all.filter(p => p.onHandQty <= p.minStockLevel);
    res.json({ success: true, data: lowStock });
  } catch (err) { next(err); }
});

// GET /api/products/:id
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        stockLedger: { orderBy: { createdAt: 'desc' }, take: 20 },
        bomProducts: { include: { components: { include: { product: true } } } }
      }
    });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({
      success: true,
      data: { ...product, freeToUseQty: Math.max(0, product.onHandQty - product.reservedQty) }
    });
  } catch (err) { next(err); }
});

// POST /api/products — admin or inventory
router.post('/', authMiddleware, requireRole('admin', 'inventory'), async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await prisma.product.create({ data });

    // Add opening stock ledger entry if qty > 0
    if (data.onHandQty > 0) {
      await prisma.stockLedger.create({
        data: {
          productId: product.id,
          type: 'opening_stock',
          qty: data.onHandQty,
          balanceQty: data.onHandQty,
          reference: 'OPENING',
          description: `Opening stock for ${product.name}`
        }
      });
    }

    await createAuditLog({ userId: req.user.id, action: 'CREATED', model: 'Product', recordId: product.id, description: `Product "${product.name}" created` });
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// PUT /api/products/:id
router.put('/:id', authMiddleware, requireRole('admin', 'inventory'), async (req, res, next) => {
  try {
    const old = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!old) return res.status(404).json({ success: false, message: 'Product not found' });

    const data = productSchema.partial().parse(req.body);
    const product = await prisma.product.update({ where: { id: req.params.id }, data });

    await createAuditLog({ userId: req.user.id, action: 'UPDATED', model: 'Product', recordId: product.id, description: `Product "${product.name}" updated`, oldValues: old, newValues: product, productId: product.id });

    // Check low stock after update
    if (product.onHandQty <= product.minStockLevel) {
      await createNotificationsForLowStock(product);
    }

    res.json({ success: true, data: { ...product, freeToUseQty: Math.max(0, product.onHandQty - product.reservedQty) } });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// DELETE /api/products/:id
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'Product archived' });
  } catch (err) { next(err); }
});

// GET /api/products/:id/stock-ledger
router.get('/:id/stock-ledger', authMiddleware, async (req, res, next) => {
  try {
    const ledger = await prisma.stockLedger.findMany({
      where: { productId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: ledger });
  } catch (err) { next(err); }
});

module.exports = router;
