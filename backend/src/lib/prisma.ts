// prisma/prismaClient.js
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ['query', 'error', 'warn'] : ['error'],
  });

// Prevent multiple instances during hot reloads (nodemon)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown handling for production and nodemon restarts
const shutdown = async () => {
  await prisma.$disconnect();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

export default prisma;
