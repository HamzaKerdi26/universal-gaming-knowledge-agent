import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { AppError, ValidationError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { ErrorResponse } from "../types/api";

// Must have 4 args for Express to recognize this as an error handler.
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    message = env.isProduction ? "Internal server error" : err.message;
  }

  if (statusCode >= 500) {
    logger.error(err.message, { stack: err.stack });
  }

  const body: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(details ? { details } : {}),
    },
  };

  res.status(statusCode).json(body);
};
