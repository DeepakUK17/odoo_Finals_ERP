const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');

// GET /api/notifications
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { OR: [{ userId: req.user.id }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) { next(err); }
});

// POST /api/notifications/:id/read
router.post('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    await prisma.notification.update({ where: { id: req.params.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /api/notifications/read-all
router.post('/read-all', authMiddleware, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { OR: [{ userId: req.user.id }, { userId: null }], isRead: false },
      data: { isRead: true }
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
