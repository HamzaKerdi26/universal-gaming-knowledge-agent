import { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../utils/AppError";

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
};
