import dotenv from "dotenv";
dotenv.config();
import { defineConfig } from "prisma/config";

// Check if DATABASE_URL exists, if not provide a placeholder
// This allows the config to load during build time without failing
if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL not set, using placeholder for config loading");
  process.env.DATABASE_URL = "postgresql://placeholder:placeholder@localhost:5432/placeholder";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
