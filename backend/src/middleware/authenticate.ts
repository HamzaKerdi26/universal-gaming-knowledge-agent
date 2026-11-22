import { NextFunction, Request, Response } from "express";
import { userRepository } from "../repositories/user.repository";
import { UnauthorizedError } from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    next(new UnauthorizedError("A bearer token is required"));
    return;
  }

  try {
    const identity = verifyAccessToken(match[1]);
    const user = await userRepository.findById(identity.userId);
    if (!user) {
      throw new UnauthorizedError("Invalid or expired authentication token");
    }
    req.auth = identity;
    next();
  } catch (error) {
    next(error);
  }
}