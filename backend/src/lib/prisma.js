// Prisma Client wrapper for CommonJS
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ]
      : ['error'],
  });

// Helper function to ensure database connection is active
prisma.ensureConnection = async function() {
  try {
    await this.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] Database connection lost, reconnecting...`);
    try {
      await this.$connect();
      return true;
    } catch (reconnectError) {
      console.error(`[${new Date().toISOString()}] Failed to reconnect to database:`, reconnectError.message);
      return false;
    }
  }
};

// Structured logging for Prisma queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    const timestamp = new Date().toISOString();
    const query = e.query.replace(/\s+/g, ' ').trim();
    console.log(`[${timestamp}] 🔍 Prisma Query: ${query}`);
    if (e.params && e.params !== '[]') {
      console.log(`[${timestamp}] 📋 Params: ${e.params}`);
    }
    if (e.duration) {
      const duration = `${e.duration}ms`.padEnd(8);
      console.log(`[${timestamp}] ⏱️  Duration: ${duration}`);
    }
  });

  prisma.$on('error', (e) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Prisma Error:`, e.message);
  });

  prisma.$on('warn', (e) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] ⚠️  Prisma Warning:`, e.message);
  });
}

// Prevent multiple instances during hot reloads (nodemon)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handling
const shutdown = async () => {
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

module.exports = prisma;

