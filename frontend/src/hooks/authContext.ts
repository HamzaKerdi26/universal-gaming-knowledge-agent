import { createContext } from "react";
import type { AuthCredentials, AuthUser, RegisterInput } from "../types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  restoreError: string | null;
  login(input: AuthCredentials): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);