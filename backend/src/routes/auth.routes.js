const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['admin', 'sales', 'purchase', 'manufacturing', 'inventory']),
  phone: z.string().optional(),
  position: z.string().optional()
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position }
    });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// GET /api/auth/users — admin only
router.get('/users', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, phone: true, position: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// POST /api/auth/users — admin only
router.post('/users', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return res.status(409).json({ success: false, message: 'Email already in use' });
    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// PUT /api/auth/users/:id — admin only
router.put('/users/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    const { name, role, phone, position, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, role, phone, position, isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// DELETE /api/auth/users/:id — admin only
router.delete('/users/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;
