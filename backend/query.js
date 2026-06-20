const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const prods = await prisma.product.findMany();
  console.log(JSON.stringify(prods.map(p => ({ id: p.id, name: p.name, type: p.procurementType })), null, 2));
}
main().finally(() => prisma.$disconnect());
