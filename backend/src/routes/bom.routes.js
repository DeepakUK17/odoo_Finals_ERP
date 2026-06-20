const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const { createAuditLog } = require('../services/audit.service');

// GET /api/bom
router.get('/', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const boms = await prisma.billOfMaterials.findMany({
      where: { isActive: true },
      include: {
        product: { select: { id: true, name: true } },
        components: { include: { product: { select: { id: true, name: true, unit: true, onHandQty: true } } } },
        workOperations: { include: { workCenter: true }, orderBy: { sequence: 'asc' } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: boms });
  } catch (err) { next(err); }
});

// GET /api/bom/product/:productId
router.get('/product/:productId', authMiddleware, async (req, res, next) => {
  try {
    const bom = await prisma.billOfMaterials.findFirst({
      where: { productId: req.params.productId, isActive: true },
      include: {
        components: { include: { product: { select: { id: true, name: true, unit: true, onHandQty: true, costPrice: true } } } },
        workOperations: { include: { workCenter: true }, orderBy: { sequence: 'asc' } }
      }
    });
    if (!bom) return res.status(404).json({ success: false, message: 'No BoM found for this product' });
    res.json({ success: true, data: bom });
  } catch (err) { next(err); }
});

// GET /api/bom/:id
router.get('/:id', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const bom = await prisma.billOfMaterials.findUnique({
      where: { id: req.params.id },
      include: {
        product: true,
        components: { include: { product: true } },
        workOperations: { include: { workCenter: true }, orderBy: { sequence: 'asc' } }
      }
    });
    if (!bom) return res.status(404).json({ success: false, message: 'BoM not found' });
    res.json({ success: true, data: bom });
  } catch (err) { next(err); }
});

// POST /api/bom
router.post('/', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const { productId, qty, reference, components, workOperations } = req.body;
    if (!productId || !components || components.length === 0) {
      return res.status(400).json({ success: false, message: 'productId and components are required' });
    }

    const bom = await prisma.billOfMaterials.create({
      data: {
        productId,
        qty: qty || 1,
        reference,
        components: { create: components.map(c => ({ productId: c.productId, qty: c.qty, unit: c.unit || 'units' })) },
        workOperations: workOperations ? {
          create: workOperations.map((op, idx) => ({ workCenterId: op.workCenterId, operation: op.operation, duration: op.duration || 1, sequence: idx + 1 }))
        } : undefined
      },
      include: {
        product: true,
        components: { include: { product: true } },
        workOperations: { include: { workCenter: true } }
      }
    });

    // Mark product as manufacturable
    await prisma.product.update({ where: { id: productId }, data: { canBeManufactured: true, procurementRoute: 'manufacturing' } });
    await createAuditLog({ userId: req.user.id, action: 'CREATED', model: 'BillOfMaterials', recordId: bom.id, description: `BoM created for ${bom.product.name}` });
    res.status(201).json({ success: true, data: bom });
  } catch (err) { next(err); }
});

// PUT /api/bom/:id
router.put('/:id', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const { components, workOperations, reference, qty } = req.body;
    // Delete old components and recreate
    await prisma.bomComponent.deleteMany({ where: { bomId: req.params.id } });
    await prisma.bomWorkOperation.deleteMany({ where: { bomId: req.params.id } });

    const bom = await prisma.billOfMaterials.update({
      where: { id: req.params.id },
      data: {
        reference, qty,
        components: { create: components.map(c => ({ productId: c.productId, qty: c.qty, unit: c.unit || 'units' })) },
        workOperations: workOperations ? { create: workOperations.map((op, idx) => ({ workCenterId: op.workCenterId, operation: op.operation, duration: op.duration || 1, sequence: idx + 1 })) } : undefined
      },
      include: { product: true, components: { include: { product: true } }, workOperations: { include: { workCenter: true } } }
    });

    await createAuditLog({ userId: req.user.id, action: 'UPDATED', model: 'BillOfMaterials', recordId: bom.id, description: `BoM for ${bom.product.name} updated` });
    res.json({ success: true, data: bom });
  } catch (err) { next(err); }
});

// DELETE /api/bom/:id
router.delete('/:id', authMiddleware, requireRole('admin', 'manufacturing'), async (req, res, next) => {
  try {
    const bom = await prisma.billOfMaterials.findUnique({ where: { id: req.params.id }, include: { product: true } });
    if (!bom) return res.status(404).json({ success: false, message: 'BoM not found' });

    await prisma.billOfMaterials.delete({ where: { id: req.params.id } });
    await createAuditLog({ userId: req.user.id, action: 'DELETED', model: 'BillOfMaterials', recordId: bom.id, description: `BoM for ${bom.product.name} deleted` });
    res.json({ success: true, message: 'BoM deleted successfully' });
  } catch (err) { next(err); }
});

// GET /api/bom/work-centers/all
router.get('/work-centers/all', authMiddleware, async (req, res, next) => {
  try {
    const centers = await prisma.workCenter.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    res.json({ success: true, data: centers });
  } catch (err) { next(err); }
});

module.exports = router;
