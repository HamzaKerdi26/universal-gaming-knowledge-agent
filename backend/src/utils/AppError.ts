export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    // Deliberately no Object.setPrototypeOf(this, AppError.prototype) here:
    // that line used to unconditionally reset the prototype chain to
    // AppError.prototype, which broke `instanceof NotFoundError` /
    // `instanceof ValidationError` / etc. for every subclass below (and
    // any other AppError subclass elsewhere in the codebase) — the
    // native `class X extends Error` chain already works correctly under
    // this project's ES2020 target, so the workaround wasn't needed and
    // was actively wrong here. See errorHandler.ts's
    // `err instanceof ValidationError` check, which silently never
    // matched anything before this fix.
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Administrator access required") {
    super(message, 403);
  }
}

export class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400);
    this.details = details;
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409);
  }
}
