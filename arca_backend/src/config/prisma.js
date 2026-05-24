const { PrismaClient } = require('@prisma/client');

/**
 * Shared PrismaClient singleton.
 * Prevents connection pool exhaustion from multiple PrismaClient instances.
 * In development with hot-reload, reuses the instance stored on `globalThis`.
 */
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
