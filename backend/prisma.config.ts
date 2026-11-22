// Prisma ORM 7 configuration file.
// As of Prisma 7, the database connection URL, migrations path, and seed
// command are configured here instead of in schema.prisma / package.json.
// See: https://pris.ly/d/config-datasource
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
