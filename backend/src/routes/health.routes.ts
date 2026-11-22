import { Router } from "express";
import { healthController } from "../controllers/health.controller";

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service (and database) is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 service: { type: string }
 *                 database: { type: string, example: ok }
 *                 timestamp: { type: string, format: date-time }
 *       503:
 *         description: Service is degraded (e.g. database unreachable)
 */
healthRouter.get("/", healthController.check);
