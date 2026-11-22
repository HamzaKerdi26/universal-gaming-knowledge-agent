import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError, UnauthorizedError } from "./AppError";
import { AuthIdentity } from "../types/auth";

const MIN_SECRET_LENGTH = 32;

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? env.auth.jwtSecret;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new AppError("Authentication is not configured on this server.", 503);
  }
  return secret;
}

function getExpirationSeconds(): number {
  const seconds = env.auth.jwtExpiresInSeconds;
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new AppError("Authentication token expiration is misconfigured.", 503);
  }
  return seconds;
}

export function createAccessToken(userId: string): string {
  return jwt.sign({}, getSecret(), {
    algorithm: "HS256",
    subject: userId,
    expiresIn: getExpirationSeconds(),
  });
}

export function verifyAccessToken(token: string): AuthIdentity {
  const secret = getSecret();
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof (payload as JwtPayload).sub !== "string") {
      throw new UnauthorizedError("Invalid or expired authentication token");
    }
    return { userId: (payload as JwtPayload).sub as string };
  } catch {
    throw new UnauthorizedError("Invalid or expired authentication token");
  }
}