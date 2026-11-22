import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller";
import { requireAuth } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import {
  conversationIdParamSchema,
  createConversationSchema,
  paginationQuerySchema,
} from "../types/conversation";

export const conversationRouter = Router();

/**
 * @openapi
 * /conversations:
 *   get:
 *     summary: List the authenticated user's conversations
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, maximum: 1000000, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 100 }
 *     responses:
 *       200:
 *         description: Conversations owned by the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversations:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/Conversation' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       401:
 *         description: Missing, invalid, or expired bearer token
 */
conversationRouter.get(
  "/",
  requireAuth,
  validate(paginationQuerySchema, "query"),
  conversationController.list
);

/**
 * @openapi
 * /conversations:
 *   post:
 *     summary: Create a conversation for the authenticated user
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateConversationInput'
 *     responses:
 *       201:
 *         description: Created conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversation: { $ref: '#/components/schemas/Conversation' }
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Missing, invalid, or expired bearer token
 */
conversationRouter.post(
  "/",
  requireAuth,
  validate(createConversationSchema, "body"),
  conversationController.create
);

/**
 * @openapi
 * /conversations/{conversationId}:
 *   get:
 *     summary: Get an owned conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, maximum: 1000000, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 100 }
 *     responses:
 *       200:
 *         description: The owned conversation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversation: { $ref: '#/components/schemas/Conversation' }
 *       400:
 *         description: Invalid conversation ID
 *       401:
 *         description: Missing, invalid, or expired bearer token
 *       404:
 *         description: Conversation not found or not owned by the authenticated user
 */
conversationRouter.get(
  "/:conversationId",
  requireAuth,
  validate(conversationIdParamSchema, "params"),
  conversationController.getById
);

/**
 * @openapi
 * /conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages from an owned conversation in chronological order
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Messages in chronological order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/ConversationMessage' }
 *                     pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid conversation ID
 *       401:
 *         description: Missing, invalid, or expired bearer token
 *       404:
 *         description: Conversation not found or not owned by the authenticated user
 */
conversationRouter.get(
  "/:conversationId/messages",
  requireAuth,
  validate(conversationIdParamSchema, "params"),
  validate(paginationQuerySchema, "query"),
  conversationController.getMessages
);