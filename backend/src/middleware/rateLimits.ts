import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { env } from "../config/env";

interface LimiterOptions {
  limit: number;
  windowMs?: number;
  byUser?: boolean;
}

export function createRateLimiter({ limit, windowMs = env.rateLimit.windowMs, byUser = false }: LimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: byUser
      ? (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown")
      : undefined,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: { message: "Too many requests. Please try again later." },
      });
    },
  });
}

export const authRegisterRateLimit = createRateLimiter({ limit: env.rateLimit.authRegisterLimit });
export const authLoginRateLimit = createRateLimiter({ limit: env.rateLimit.authLoginLimit });
export const chatRateLimit = createRateLimiter({ limit: env.rateLimit.chatLimit, byUser: true });
export const ragIngestRateLimit = createRateLimiter({ limit: env.rateLimit.ragIngestLimit, byUser: true });
export const sourceImportRateLimit = createRateLimiter({ limit: env.rateLimit.sourceImportLimit, byUser: true });
export const ragSearchRateLimit = createRateLimiter({ limit: env.rateLimit.ragSearchLimit });
export const sourceSearchRateLimit = createRateLimiter({ limit: env.rateLimit.sourceSearchLimit });