const TOKEN_KEY = "ugka_access_token";
export const AUTH_SESSION_EXPIRED_EVENT = "ugka:auth-session-expired";

export function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeAuthToken(token: string): boolean {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function notifyAuthSessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
}