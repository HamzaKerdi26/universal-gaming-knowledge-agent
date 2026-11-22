import { AppError } from "../../utils/AppError";

export class QdrantError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    Object.setPrototypeOf(this, QdrantError.prototype);
  }
}
