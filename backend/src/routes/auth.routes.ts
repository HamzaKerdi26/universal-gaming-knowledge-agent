import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { authLoginRateLimit, authRegisterRateLimit } from "../middleware/rateLimits";
import { loginRequestSchema, registerRequestSchema } from "../types/auth";

export const authRouter = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, username, password]
 *             properties:
 *               email: { type: string, format: email, example: player@example.com }
 *               username: { type: string, example: player-one }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       201:
 *         description: User registered with an access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid registration data
 *       409:
 *         description: Email or username is already registered
 *       429:
 *         description: Registration rate limit exceeded
 */
authRouter.post(
	"/register",
	authRegisterRateLimit,
	validate(registerRequestSchema, "body"),
	authController.register
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Authenticated user and access token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Invalid email or password
 *       429:
 *         description: Login rate limit exceeded
 */
authRouter.post(
	"/login",
	authLoginRateLimit,
	validate(loginRequestSchema, "body"),
	authController.login
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Safe user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Missing, invalid, or expired bearer token
 */
authRouter.get("/me", requireAuth, authController.me);