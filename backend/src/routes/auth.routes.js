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
  role: z.enum(['admin', 'sales', 'purchase', 'manufacturing', 'inventory', 'hr']),
  loginId: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().optional()
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Login Id and Password required' });
    
    const user = await prisma.user.findFirst({ 
      where: { OR: [{ email: email }, { loginId: email }] } 
    });
    
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid Login Id or Password' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid Login Id or Password' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '4h'
    });
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, loginId: user.loginId, role: user.role, position: user.position, avatarUrl: user.avatarUrl }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/signup
const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  loginId: z.string().min(6, "Login ID must be 6-12 chars").max(12, "Login ID must be 6-12 chars"),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/, "Password must be at least 8 characters and contain lowercase, uppercase, and special characters"),
  role: z.enum(['admin', 'sales', 'purchase', 'manufacturing', 'inventory', 'hr']).default('sales')
});

router.post('/signup', async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingEmail) return res.status(409).json({ success: false, message: 'Email already in use' });
    
    const existingLoginId = await prisma.user.findUnique({ where: { loginId: data.loginId } });
    if (existingLoginId) return res.status(409).json({ success: false, message: 'Login ID already taken' });

    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, name: true, email: true, loginId: true, role: true, avatarUrl: true }
    });
    
    // Auto-login after signup
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, message: err.errors[0]?.message });
    next(err);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { loginId, newPassword } = req.body;
    if (!loginId || !newPassword) return res.status(400).json({ success: false, message: 'Login ID and new password required' });
    
    const user = await prisma.user.findFirst({ where: { OR: [{ email: loginId }, { loginId: loginId }] } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and contain lowercase, uppercase, and special characters' });
    }
    
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch(err) { next(err); }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { name, phone, password, avatarUrl } = req.body;
    const data = { name, phone, avatarUrl };
    
    if (password) {
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/.test(password)) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and contain lowercase, uppercase, and special characters' });
      }
      data.password = await bcrypt.hash(password, 12);
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, loginId: true, role: true, avatarUrl: true }
    });
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, loginId: true, role: true, position: true, avatarUrl: true }});
  res.json({ success: true, user: user });
});

// GET /api/auth/users — admin only
router.get('/users', authMiddleware, requireRole('admin', 'hr'), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, loginId: true, role: true, phone: true, position: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// POST /api/auth/users — admin only
router.post('/users', authMiddleware, requireRole('admin', 'hr'), async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) return res.status(409).json({ success: false, message: 'Email already in use' });
    const hashed = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, name: true, email: true, loginId: true, role: true, isActive: true }
    });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ success: false, errors: err.errors });
    next(err);
  }
});

// PUT /api/auth/users/:id — admin only
router.put('/users/:id', authMiddleware, requireRole('admin', 'hr'), async (req, res, next) => {
  try {
    const { name, role, phone, position, isActive, loginId } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { name, role, phone, position, isActive, loginId },
      select: { id: true, name: true, email: true, loginId: true, role: true, isActive: true }
    });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// DELETE /api/auth/users/:id — admin only
router.delete('/users/:id', authMiddleware, requireRole('admin', 'hr'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;
