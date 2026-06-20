const prisma = require('../lib/prisma');

/**
 * Update product stock and create a stock ledger entry.
 * qty: positive = stock IN, negative = stock OUT
 */
async function updateStock(productId, qty, type, reference, description) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error(`Product not found: ${productId}`);

  const newBalance = product.onHandQty + qty;

  await prisma.product.update({
    where: { id: productId },
    data: { onHandQty: Math.max(0, newBalance) }
  });

  await prisma.stockLedger.create({
    data: {
      productId,
      type,
      qty,
      balanceQty: Math.max(0, newBalance),
      reference,
      description
    }
  });

  return { productId, qty, newBalance: Math.max(0, newBalance) };
}

module.exports = { updateStock };
