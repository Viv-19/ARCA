const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const departments = [
  { name: "IT Security",              email: "it-security@canarabank.com" },
  { name: "Digital Banking IT",       email: "digital-it@canarabank.com" },
  { name: "Core Banking IT",          email: "cbs-it@canarabank.com" },
  { name: "Compliance Central",       email: "compliance@canarabank.com" },
  { name: "Legal",                    email: "legal@canarabank.com" },
  { name: "HR and Training",          email: "hr@canarabank.com" },
  { name: "Risk Management",          email: "risk@canarabank.com" },
  { name: "Retail Banking Ops",       email: "retail@canarabank.com" },
  { name: "Corporate Banking Ops",    email: "corporate@canarabank.com" },
  { name: "Treasury",                 email: "treasury@canarabank.com" },
  { name: "Audit",                    email: "audit@canarabank.com" },
  { name: "NRI Services",             email: "nri@canarabank.com" },
  { name: "Operations",               email: "operations@canarabank.com" }
];

async function main() {
  console.log("[Seed] Starting to populate Bank Departments into PostgreSQL...");
  for (const dept of departments) {
    const d = await prisma.department.upsert({
      where: { name: dept.name },
      update: { email: dept.email },
      create: { name: dept.name, email: dept.email }
    });
    console.log(`[Seed] Seeded department: "${d.name}" (${d.email})`);
  }
  console.log("[Seed] Seeding of Bank Departments successfully completed!");
}

main()
  .catch((e) => {
    console.error("[Seed Error] Failed to run database seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
