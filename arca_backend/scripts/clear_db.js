const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database tables...');
  
  await prisma.alert.deleteMany();
  console.log('- Cleared Alerts');

  await prisma.auditLog.deleteMany();
  console.log('- Cleared AuditLogs');

  await prisma.evidence.deleteMany();
  console.log('- Cleared Evidence');

  await prisma.map.deleteMany();
  console.log('- Cleared Maps');

  await prisma.document.deleteMany();
  console.log('- Cleared Documents');

  console.log('Database clear completed.');
}

main()
  .catch((e) => {
    console.error('Error clearing database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
