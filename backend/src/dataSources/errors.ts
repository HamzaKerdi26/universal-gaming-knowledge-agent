import { AppError } from "../utils/AppError";

export class DataSourceError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    Object.setPrototypeOf(this, DataSourceError.prototype);
  }
}
