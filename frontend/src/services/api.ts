import axios from "axios";
import {
  clearAuthToken,
  getAuthToken,
  notifyAuthSessionExpired,
} from "./authTokenStorage";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      error.config?.headers?.Authorization
    ) {
      clearAuthToken();
      notifyAuthSessionExpired();
    }
    return Promise.reject(error);
  }
);
