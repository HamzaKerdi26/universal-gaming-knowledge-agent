import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { asyncHandler } from "../utils/asyncHandler";

export const healthController = {
  check: asyncHandler(async (_req: Request, res: Response) => {
    let databaseStatus: "ok" | "error" = "ok";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      databaseStatus = "error";
    }

    const status = databaseStatus === "ok" ? "ok" : "degraded";

    res.status(databaseStatus === "ok" ? 200 : 503).json({
      status,
      service: "universal-gaming-knowledge-agent",
      database: databaseStatus,
      timestamp: new Date().toISOString(),
    });
  }),
};
