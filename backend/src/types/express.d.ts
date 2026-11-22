import { AuthIdentity } from "./auth";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}

export {};