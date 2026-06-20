const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

// GET /api/audit — admin only, paginated
router.get('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { model, page = 1, limit = 50, search } = req.query;
    const where = {};
    if (model) where.model = model;
    if (search) where.description = { contains: search, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { timestamp: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({ success: true, data: logs, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /api/audit/models — unique model names
router.get('/models', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const models = await prisma.auditLog.findMany({
      select: { model: true },
      distinct: ['model']
    });
    res.json({ success: true, data: models.map(m => m.model) });
  } catch (err) { next(err); }
});

module.exports = router;
