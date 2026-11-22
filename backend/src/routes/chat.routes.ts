import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { validate } from "../middleware/validate";
import { chatRequestSchema } from "../types/chat";
import { requireAuth } from "../middleware/authenticate";
import { chatRateLimit } from "../middleware/rateLimits";

export const chatRouter = Router();

/**
 * @openapi
 * /chat:
 *   post:
 *     summary: Send a message to the Universal Gaming Knowledge Agent
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: What is the maximum level in Dark Souls III?
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *                 description: Omit to start a new conversation.
 *     responses:
 *       200:
 *         description: The assistant's reply
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *                     model: { type: string }
 *                     provider: { type: string }
 *                     conversationId: { type: string, format: uuid }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing, invalid, or expired bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Chat rate limit exceeded
 *       404:
 *         description: conversationId does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: The AI provider failed or is unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: AI chat is not configured on this server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       504:
 *         description: The AI provider timed out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
chatRouter.post(
	"/",
	requireAuth,
	chatRateLimit,
	validate(chatRequestSchema, "body"),
	chatController.sendMessage
);
