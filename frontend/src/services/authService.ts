import { apiClient } from "./api";
import type { ApiSuccessResponse } from "../types/game";
import type { AuthCredentials, AuthSession, AuthUser, RegisterInput } from "../types/auth";

export const authService = {
  async login(input: AuthCredentials): Promise<AuthSession> {
    const response = await apiClient.post<ApiSuccessResponse<AuthSession>>("/auth/login", input);
    return response.data.data;
  },

  async register(input: RegisterInput): Promise<AuthSession> {
    const response = await apiClient.post<ApiSuccessResponse<AuthSession>>("/auth/register", input);
    return response.data.data;
  },

  async me(): Promise<AuthUser> {
    const response = await apiClient.get<ApiSuccessResponse<{ user: AuthUser }>>("/auth/me");
    return response.data.data.user;
  },
};