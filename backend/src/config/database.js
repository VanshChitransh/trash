// Database configuration for Neon (PostgreSQL with Prisma)
const prisma = require('../lib/prisma');

// Connect to database (Prisma handles connection pooling)
const connectDB = async () => {
  try {
    // Test connection by running a simple query
    await prisma.$connect();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ✅ Neon (PostgreSQL) database connected via Prisma`);
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Database connection error:`, error.message);
    process.exit(1);
  }
};

// Check database health
const checkDBHealth = async () => {
  try {
    // Test connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      message: 'Neon (PostgreSQL) database connection is active',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await prisma.$disconnect();
    console.log('Database connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.log('Error while closing database connection:', error.message);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await prisma.$disconnect();
    console.log('Database connection closed through app termination');
    process.exit(0);
  } catch (error) {
    console.log('Error while closing database connection:', error.message);
    process.exit(1);
  }
});

module.exports = {
  connectDB,
  checkDBHealth,
};
