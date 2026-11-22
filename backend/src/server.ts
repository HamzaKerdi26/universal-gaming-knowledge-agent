import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { validateStartupConfig } from "./config/startupValidation";
import { logger } from "./utils/logger";

validateStartupConfig();

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port} (${env.nodeEnv})`);
  logger.info(`Swagger docs available at http://localhost:${env.port}/api/docs`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
