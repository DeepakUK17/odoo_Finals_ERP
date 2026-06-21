const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth.middleware');

const prisma = new PrismaClient();
const router = express.Router();

// Get daily attendance sheet (HR/Admin only)
router.get('/daily', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'hr') return res.status(403).json({ error: 'Access denied' });
  try {
    const dateStr = req.query.date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateStr);
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    
    targetDate.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true }
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: { date: targetDate }
    });

    const sheet = users.map(u => {
      const record = attendanceRecords.find(a => a.userId === u.id);
      return {
        user: u,
        status: record ? record.status : null,
        attendanceId: record ? record.id : null
      };
    });

    res.json(sheet);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily sheet' });
  }
});

// Update attendance status (HR/Admin only)
router.put('/daily', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'hr') return res.status(403).json({ error: 'Access denied' });
  try {
    const { userId, date, status } = req.body;
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const existing = await prisma.attendance.findFirst({
      where: { userId, date: targetDate }
    });

    if (existing) {
      const updated = await prisma.attendance.update({
        where: { id: existing.id },
        data: { status }
      });
      return res.json(updated);
    } else {
      const created = await prisma.attendance.create({
        data: { userId, date: targetDate, status }
      });
      return res.json(created);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});


// Get monthly attendance report (Admin/HR only)
router.get('/monthly', authenticate, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'hr') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const { month, year } = req.query; // Expecting month 1-12, year YYYY
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true }
    });

    const logs = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    const report = users.map(u => {
      const userLogs = logs.filter(l => l.userId === u.id);
      
      let presentCount = userLogs.filter(l => l.status === 'present').length;
      let absentCount = userLogs.filter(l => l.status === 'absent').length;
      let leaveCount = userLogs.filter(l => l.status === 'leave').length;
      let halfDayCount = userLogs.filter(l => l.status === 'half_day').length;

      // 2 half days = 1 absent + 1 present
      const halfDayPairs = Math.floor(halfDayCount / 2);
      const remainingHalfDays = halfDayCount % 2;

      const totalPresent = presentCount + halfDayPairs + (remainingHalfDays ? 0.5 : 0);
      const totalAbsent = absentCount + halfDayPairs + (remainingHalfDays ? 0.5 : 0);

      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        totalPresent,
        totalAbsent,
        totalLeaves: leaveCount
      };
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly report' });
  }
});

// Export Monthly Matrix CSV
router.get('/export', async (req, res) => {
  const { token, month, year } = req.query;
  // Handle token authentication via query parameter for window.open
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role !== 'admin' && decoded.role !== 'hr') throw new Error('Unauthorized');
  } catch (err) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    const daysInMonth = endDate.getDate();

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true }
    });

    const logs = await prisma.attendance.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });

    let header = "Employee,Role,";
    for (let i = 1; i <= daysInMonth; i++) {
      header += `${i},`;
    }
    header += "Total Present,Total Absent,Total Leaves\n";

    const csvRows = users.map(u => {
      let row = `"${u.name}",${u.role},`;
      
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      let halfDayCount = 0;

      for (let i = 1; i <= daysInMonth; i++) {
        const currentDateStr = new Date(year, month - 1, i, 12).toISOString().split('T')[0];
        const log = logs.find(l => l.userId === u.id && l.date.toISOString().split('T')[0] === currentDateStr);
        
        if (log) {
          if (log.status === 'present') { presentCount++; row += 'P,'; }
          else if (log.status === 'absent') { absentCount++; row += 'A,'; }
          else if (log.status === 'leave') { leaveCount++; row += 'L,'; }
          else if (log.status === 'half_day') { halfDayCount++; row += 'HD,'; }
          else row += '-,';
        } else {
          row += '-,';
        }
      }

      const halfDayPairs = Math.floor(halfDayCount / 2);
      const remainingHalfDays = halfDayCount % 2;

      const totalPresent = presentCount + halfDayPairs + (remainingHalfDays ? 0.5 : 0);
      const totalAbsent = absentCount + halfDayPairs + (remainingHalfDays ? 0.5 : 0);

      row += `${totalPresent},${totalAbsent},${leaveCount}`;
      return row;
    });

    const csvContent = header + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${year}_${month}.csv`);
    res.send(csvContent);
  } catch (error) {
    res.status(500).send('Failed to generate CSV');
  }
});

module.exports = router;
