import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./env";

// Prisma 7 removed the built-in Rust query engine from Prisma Client —
// a driver adapter is now required to connect to the database.
const adapter = new PrismaPg({ connectionString: env.databaseUrl });

// A single shared Prisma client instance for the whole app.
// Reused across requests to avoid exhausting DB connections.
export const prisma = new PrismaClient({
  adapter,
  log: env.isProduction ? ["error", "warn"] : ["error", "warn"],
});
