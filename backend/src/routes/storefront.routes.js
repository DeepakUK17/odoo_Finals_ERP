const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { emitDataUpdated } = require('../lib/socket');

// Optional auth middleware specifically for storefront
const storeAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, address, password } = req.body;
    
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone,
        address,
        password: hashedPassword,
        role: 'customer'
      }
    });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.role !== 'customer') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get Products
router.get('/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { productType: 'finished', canBeSold: true, isActive: true },
      orderBy: [
        { name: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Deduplicate by name
    const uniqueProducts = [];
    const seen = new Set();
    for (const p of products) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        uniqueProducts.push({
          id: p.id,
          name: p.name,
          description: p.description,
          salesPrice: p.salesPrice,
          onHandQty: Math.max(0, p.onHandQty - p.reservedQty)
        });
      }
    }

    res.json({ data: uniqueProducts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Checkout (Create Sales Order)
router.post('/checkout', storeAuth, async (req, res) => {
  try {
    const { cart } = req.body; // Array of { productId, qty }
    const customerId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: customerId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate Order Number
    const count = await prisma.salesOrder.count();
    const orderNo = `SO-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Get product details to calculate total
    const productIds = cart.map(item => item.productId);
    const dbProducts = await prisma.product.findMany({ where: { id: { in: productIds } } });

    let totalAmount = 0;
    const itemsData = cart.map(item => {
      const dbProd = dbProducts.find(p => p.id === item.productId);
      if (!dbProd) throw new Error(`Product ${item.productId} not found`);
      const qty = parseFloat(item.qty) || 1;
      const unitPrice = dbProd.salesPrice;
      totalAmount += qty * unitPrice;
      
      return {
        productId: item.productId,
        qty,
        unitPrice,
        totalPrice: qty * unitPrice,
        deliveredQty: 0
      };
    });

    // Create Sales Order in draft status
    const order = await prisma.salesOrder.create({
      data: {
        orderNo,
        customer: user.name,
        customerEmail: user.email,
        customerPhone: user.phone || '',
        totalAmount,
        status: 'draft',
        createdById: user.id, // For tracking
        items: {
          create: itemsData
        }
      }
    });

    // Broadcast update to ERP clients
    emitDataUpdated('sales');

    res.json({ success: true, orderNo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// Get My Orders
router.get('/orders', storeAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    const orders = await prisma.salesOrder.findMany({
      where: { createdById: customerId },
      include: {
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
