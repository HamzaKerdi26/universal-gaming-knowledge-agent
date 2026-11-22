import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ForbiddenError, UnauthorizedError } from "../utils/AppError";

const ADMIN_USER_IDS = new Set(env.auth.adminUserIds);

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.auth?.userId;
  if (!userId) {
    next(new UnauthorizedError("Authentication required"));
    return;
  }
  if (!ADMIN_USER_IDS.has(userId)) {
    next(new ForbiddenError());
    return;
  }
  next();
}