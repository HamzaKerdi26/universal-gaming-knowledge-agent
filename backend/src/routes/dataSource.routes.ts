import { Router } from "express";
import { dataSourceController } from "../controllers/dataSource.controller";
import { validate } from "../middleware/validate";
import { importBodySchema, searchQuerySchema, sourceParamSchema } from "../types/dataSource";
import { requireAuth } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/requireAdmin";
import { sourceImportRateLimit, sourceSearchRateLimit } from "../middleware/rateLimits";

export const dataSourceRouter = Router();

/**
 * @openapi
 * /sources:
 *   get:
 *     summary: List available game/knowledge data sources
 *     tags: [DataSources]
 *     responses:
 *       200:
 *         description: The registered data sources
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sources:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name: { type: string, example: rawg }
 *                           sourceType: { type: string, example: API }
 */
dataSourceRouter.get("/", dataSourceController.list);

/**
 * @openapi
 * /sources/{source}/search:
 *   get:
 *     summary: Search a specific data source
 *     tags: [DataSources]
 *     parameters:
 *       - in: path
 *         name: source
 *         required: true
 *         schema: { type: string }
 *         example: rawg
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         example: Elden Ring
 *     responses:
 *       200:
 *         description: Matching results from the source
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           externalId: { type: string }
 *                           title: { type: string }
 *                           sourceUrl: { type: string }
 *       400:
 *         description: Validation error (missing/empty q)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Unknown data source
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: The data source returned an error or is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Source search rate limit exceeded
 */
dataSourceRouter.get(
  "/:source/search",
  sourceSearchRateLimit,
  validate(sourceParamSchema, "params"),
  validate(searchQuerySchema, "query"),
  dataSourceController.search
);

/**
 * @openapi
 * /sources/{source}/import:
 *   post:
 *     summary: Import a record from a data source (persists structured game data, ingests knowledge into RAG)
 *     tags: [DataSources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: source
 *         required: true
 *         schema: { type: string }
 *         example: rawg
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [externalId]
 *             properties:
 *               externalId:
 *                 type: string
 *                 description: The source's own identifier for the record (from a prior search).
 *     responses:
 *       200:
 *         description: The imported record, and whether it was persisted/ingested
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     record: { type: object }
 *                     game: { type: object, nullable: true }
 *                     ragIngested: { type: boolean }
 *       400:
 *         description: Validation error (missing externalId)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Unknown data source, or no record found for the given externalId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: The data source returned an error or is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       429:
 *         description: Source import rate limit exceeded
 */
dataSourceRouter.post(
  "/:source/import",
  requireAuth,
  requireAdmin,
  sourceImportRateLimit,
  validate(sourceParamSchema, "params"),
  validate(importBodySchema, "body"),
  dataSourceController.import
);
