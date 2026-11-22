import { Router } from "express";
import { ragController } from "../controllers/rag.controller";
import { validate } from "../middleware/validate";
import { documentIdParamSchema, ingestRequestSchema, searchRequestSchema } from "../types/rag";
import { requireAuth } from "../middleware/authenticate";
import { requireAdmin } from "../middleware/requireAdmin";
import { ragIngestRateLimit, ragSearchRateLimit } from "../middleware/rateLimits";

export const ragRouter = Router();

/**
 * @openapi
 * /rag/ingest:
 *   post:
 *     summary: Run the RAG ingestion pipeline over a local file or directory
 *     tags: [RAG]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [path]
 *             properties:
 *               path:
 *                 type: string
 *                 example: data/knowledge/elden-ring
 *                 description: >
 *                   A local path (file or directory) to load documents
 *                   from. Directories are scanned recursively for .md/.txt files.
 *     responses:
 *       200:
 *         description: Ingestion summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentsProcessed: { type: integer }
 *                     chunksCreated: { type: integer }
 *                     documentIds:
 *                       type: array
 *                       items: { type: string }
 *       400:
 *         description: Validation error (e.g. missing path, empty/invalid documents)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: The given path does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Administrator access required
 *       429:
 *         description: Ingestion rate limit exceeded
 */
ragRouter.post(
  "/ingest",
  requireAuth,
  requireAdmin,
  ragIngestRateLimit,
  validate(ingestRequestSchema, "body"),
  ragController.ingest
);

/**
 * @openapi
 * /rag/documents/{documentId}/chunks:
 *   get:
 *     summary: Preview the chunks produced for a previously ingested document
 *     tags: [RAG]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string }
 *         example: elden-ring-overview
 *     responses:
 *       200:
 *         description: The chunks for this document
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     documentId: { type: string }
 *                     chunkCount: { type: integer }
 *                     chunks:
 *                       type: array
 *                       items:
 *                         type: object
 *       404:
 *         description: No ingested chunks found for this document id (run ingestion first)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
ragRouter.get(
  "/documents/:documentId/chunks",
  validate(documentIdParamSchema, "params"),
  ragController.getChunks
);

/**
 * @openapi
 * /rag/search:
 *   post:
 *     summary: Search previously ingested knowledge by semantic similarity
 *     tags: [RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 example: How does combat work in Elden Ring?
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 5
 *               gameSlug:
 *                 type: string
 *                 example: elden-ring
 *                 description: Restrict results to a single game.
 *               category:
 *                 type: string
 *                 example: combat
 *                 description: Restrict results to a single category (e.g. combat, lore).
 *     responses:
 *       200:
 *         description: Matching chunks, most similar first
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
 *                           score: { type: number }
 *                           chunkId: { type: string }
 *                           documentId: { type: string }
 *                           gameSlug: { type: string }
 *                           category: { type: string }
 *                           title: { type: string }
 *                           content: { type: string }
 *                           chunkIndex: { type: integer }
 *       400:
 *         description: Validation error (empty query, invalid limit, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No knowledge has been ingested yet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: The embedding provider or Qdrant is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Vector search is not configured on this server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: RAG search rate limit exceeded
 */
ragRouter.post(
  "/search",
  ragSearchRateLimit,
  validate(searchRequestSchema, "body"),
  ragController.search
);
