import { NextFunction, Request, Response } from "express";
import { ZodError, ZodType } from "zod";
import { ValidationError } from "../utils/AppError";

type RequestPart = "body" | "params" | "query";

// Validates request data without assigning to Express 5's getter-only req.query.
export const validate =
  (schema: ZodType, part: RequestPart = "body") =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[part]);
      if (part === "query") {
        res.locals.validatedQuery = parsed;
      } else {
        req[part] = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((e) => ({
          path: e.path.join("."),
          message: e.message,
        }));
        next(new ValidationError("Validation failed", details));
        return;
      }
      next(err);
    }
  };
