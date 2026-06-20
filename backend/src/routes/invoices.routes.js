const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

// GET /api/invoices
router.get('/', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      include: { salesOrder: { select: { orderNo: true } } }
    });
    res.json({ success: true, data: invoices });
  } catch (err) { next(err); }
});

// GET /api/invoices/:id
router.get('/:id', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { 
        salesOrder: { include: { items: { include: { product: true } } } },
        payments: { orderBy: { paymentDate: 'desc' } }
      }
    });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    res.json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// POST /api/invoices — Create Invoice from SO
router.post('/', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const { salesOrderId } = req.body;
    
    const so = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } });
    if (!so) return res.status(404).json({ success: false, message: 'Sales Order not found' });

    // Prevent duplicate invoices
    const existing = await prisma.invoice.findFirst({ where: { salesOrderId } });
    if (existing) return res.status(400).json({ success: false, message: 'Invoice already exists for this order' });

    const totalAmount = so.totalAmount;
    const taxRate = 18.0;
    const taxAmount = totalAmount * (taxRate / 100);
    const netAmount = totalAmount + taxAmount;

    // Generate Invoice No
    const lastInvoice = await prisma.invoice.findFirst({ orderBy: { invoiceNo: 'desc' } });
    const lastNum = lastInvoice ? parseInt(lastInvoice.invoiceNo.split('-')[1]) : 0;
    const invoiceNo = `INV-${String(lastNum + 1).padStart(4, '0')}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        salesOrderId,
        customer: so.customer,
        totalAmount,
        taxRate,
        taxAmount,
        netAmount,
        status: 'draft',
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days
      }
    });

    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
});

// POST /api/invoices/:id/payment — Record Payment
router.post('/:id/payment', authMiddleware, requireRole('admin', 'sales'), async (req, res, next) => {
  try {
    const { amount, method, reference } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid payment amount' });

    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const remaining = invoice.netAmount - invoice.amountPaid;
    if (amount > remaining) return res.status(400).json({ success: false, message: `Payment exceeds remaining balance (₹${remaining})` });

    const newPaid = invoice.amountPaid + amount;
    let newStatus = invoice.status;
    
    // Status Logic
    if (newPaid >= invoice.netAmount) {
      newStatus = 'paid';
    } else if (newPaid > 0) {
      newStatus = 'partially_paid';
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amount,
          method,
          reference
        }
      });
      return tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: newPaid, status: newStatus }
      });
    });

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

module.exports = router;
