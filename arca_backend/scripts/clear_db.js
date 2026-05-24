const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("[Clean DB] Initiating database cleanup...");
  
  try {
    // Delete in order of dependencies (evidence files first, then maps, then documents/departments)
    console.log("[Clean DB] Deleting Evidence records...");
    await prisma.evidence.deleteMany({});
    
    console.log("[Clean DB] Deleting AuditLog records...");
    await prisma.auditLog.deleteMany({});
    
    console.log("[Clean DB] Deleting Alert records...");
    await prisma.alert.deleteMany({});
    
    console.log("[Clean DB] Deleting Map records...");
    await prisma.map.deleteMany({});
    
    console.log("[Clean DB] Deleting Document records...");
    await prisma.document.deleteMany({});
    
    console.log("[Clean DB] Deleting Department records...");
    await prisma.department.deleteMany({});

    console.log("[Clean DB] Database successfully cleared!");
  } catch (error) {
    console.error("[Clean DB Error]", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
