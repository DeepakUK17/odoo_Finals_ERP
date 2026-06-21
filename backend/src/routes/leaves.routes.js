const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth.middleware');

const prisma = new PrismaClient();
const router = express.Router();

// Get my leaves
router.get('/my', authenticate, async (req, res) => {
  try {
    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaves' });
  }
});

// Apply for leave
router.post('/apply', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, type, customType, reason } = req.body;

    const leave = await prisma.leaveRequest.create({
      data: {
        userId: req.user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type, // 'sick', 'casual', 'permission', 'other'
        customType: type === 'other' ? customType : null,
        reason,
        status: 'pending'
      }
    });

    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: 'Failed to apply for leave' });
  }
});

// Get all leaves (Admin/HR only)
router.get('/all', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'hr') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const leaves = await prisma.leaveRequest.findMany({
      include: {
        user: { select: { name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leaves);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all leaves' });
  }
});

// Approve/Reject leave
router.put('/:id/status', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'hr') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved', 'rejected'

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: { status }
    });

    if (status === 'approved') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const days = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }

      for (const d of days) {
        const dateStr = d.toISOString().split('T')[0];
        const existing = await prisma.attendance.findFirst({
          where: { userId: leave.userId, date: new Date(dateStr) }
        });
        if (existing) {
          await prisma.attendance.update({
            where: { id: existing.id },
            data: { status: 'leave' }
          });
        } else {
          await prisma.attendance.create({
            data: {
              userId: leave.userId,
              date: new Date(dateStr),
              status: 'leave'
            }
          });
        }
      }
    }

    res.json(leave);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave status' });
  }
});

// Revoke leave
router.delete('/:id/revoke', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) return res.status(404).json({ error: 'Not found' });
    if (leave.userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'hr') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.leaveRequest.delete({ where: { id } });
    
    if (leave.status === 'approved') {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      const days = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      for (const d of days) {
        const dateStr = d.toISOString().split('T')[0];
        const existing = await prisma.attendance.findFirst({
          where: { userId: leave.userId, date: new Date(dateStr) }
        });
        if (existing && existing.status === 'leave') {
          await prisma.attendance.delete({ where: { id: existing.id } });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke leave' });
  }
});

module.exports = router;
