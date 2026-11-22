import { useEffect, useState, type ReactNode } from "react";
import { authService } from "../services/authService";
import {
  AUTH_SESSION_EXPIRED_EVENT,
  clearAuthToken,
  getAuthToken,
  storeAuthToken,
} from "../services/authTokenStorage";
import { AuthContext } from "./authContext";
import type { AuthCredentials, AuthSession, AuthUser, RegisterInput } from "../types/auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(getAuthToken()));
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const handleSessionExpired = () => {
      clearAuthToken();
      setUser(null);
      setRestoreError(null);
      setIsLoading(false);
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    if (getAuthToken()) {
      authService
        .me()
        .then((restoredUser) => {
          if (mounted) setUser(restoredUser);
        })
        .catch(() => {
          if (mounted && getAuthToken()) {
            setRestoreError("We couldn't verify your saved session. Please sign in again.");
          }
        })
        .finally(() => {
          if (mounted) setIsLoading(false);
        });
    }

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  async function acceptSession(session: AuthSession): Promise<void> {
    if (!storeAuthToken(session.token)) {
      throw new Error("Browser storage is unavailable. Enable site storage and try again.");
    }
    setUser(session.user);
    setRestoreError(null);
  }

  async function login(input: AuthCredentials): Promise<void> {
    await acceptSession(await authService.login(input));
  }

  async function register(input: RegisterInput): Promise<void> {
    await acceptSession(await authService.register(input));
  }

  function logout(): void {
    clearAuthToken();
    setUser(null);
    setRestoreError(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, restoreError, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}