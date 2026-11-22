import { env } from "./env";

export function validateStartupConfig(config: typeof env = env): void {
  if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }

  if (!Number.isSafeInteger(config.auth.jwtExpiresInSeconds) || config.auth.jwtExpiresInSeconds <= 0) {
    throw new Error("JWT_EXPIRES_IN_SECONDS must be a positive integer.");
  }

  if (config.cors.allowedOrigins.includes("*")) {
    throw new Error("FRONTEND_ORIGINS must list explicit origins; wildcard origins are not allowed.");
  }

  if (config.isProduction && config.cors.allowedOrigins.length === 0) {
    throw new Error("FRONTEND_ORIGINS must be configured in production.");
  }

  for (const origin of config.cors.allowedOrigins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error("FRONTEND_ORIGINS contains an invalid origin.");
    }
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.origin !== origin) {
      throw new Error("FRONTEND_ORIGINS must contain only HTTP(S) origins without paths.");
    }
  }

  const rateLimits = [
    config.rateLimit.windowMs,
    config.rateLimit.authRegisterLimit,
    config.rateLimit.authLoginLimit,
    config.rateLimit.chatLimit,
    config.rateLimit.ragIngestLimit,
    config.rateLimit.sourceImportLimit,
    config.rateLimit.ragSearchLimit,
    config.rateLimit.sourceSearchLimit,
  ];
  if (rateLimits.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error("Rate-limit settings must be positive integers.");
  }
}