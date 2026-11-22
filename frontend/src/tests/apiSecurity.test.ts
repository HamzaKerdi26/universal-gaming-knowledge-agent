import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock auth token storage functions (vi.mock hoists these to top)
vi.mock('../services/authTokenStorage', () => ({
  clearAuthToken: vi.fn(),
  getAuthToken: vi.fn(),
  notifyAuthSessionExpired: vi.fn(),
}));

// Import after mocks are set up
import { apiClient } from '../services/api';
import { clearAuthToken, getAuthToken, notifyAuthSessionExpired } from '../services/authTokenStorage';

describe('API Client Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthToken.mockReturnValue(null);
  });

  describe('API Client Configuration', () => {
    it('should use the configured base URL from environment', () => {
      // When VITE_API_BASE_URL is not set, the default should be used
      expect(apiClient.defaults.baseURL).toBe('http://localhost:5000/api');
    });

    it('should have JSON content type header', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Request Interceptor - Authentication Token', () => {
    it('should attach Bearer token to requests when a token exists', () => {
      getAuthToken.mockReturnValue('test-token-123');

      const config = { headers: {} };
      apiClient.interceptors.request.handlers[0]!.fulfilled(config);

      expect(config.headers.Authorization).toBe('Bearer test-token-123');
    });

    it('should not attach Authorization header when no token exists', () => {
      getAuthToken.mockReturnValue(null);

      const config = { headers: {} };
      apiClient.interceptors.request.handlers[0]!.fulfilled(config);

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor - 401 Handling', () => {
    it('should clear token and notify on 401 with Authorization header', async () => {
      getAuthToken.mockReturnValue('test-token');

      const error = {
        isAxiosError: true,
        response: { status: 401 },
        config: { headers: { Authorization: 'Bearer test-token' } },
      };

      await expect(
        apiClient.interceptors.response.handlers[0].rejected(error)
      ).rejects.toEqual(error);

      expect(clearAuthToken).toHaveBeenCalled();
      expect(notifyAuthSessionExpired).toHaveBeenCalled();
    });

    it('should not clear token on 401 without Authorization header', async () => {
      getAuthToken.mockReturnValue('test-token');

      const error = {
        isAxiosError: true,
        response: { status: 401 },
        config: { headers: {} },
      };

      await expect(
        apiClient.interceptors.response.handlers[0].rejected(error)
      ).rejects.toEqual(error);

      expect(clearAuthToken).not.toHaveBeenCalled();
      expect(notifyAuthSessionExpired).not.toHaveBeenCalled();
    });

    it('should reject non-401 errors without side effects', async () => {
      getAuthToken.mockReturnValue('test-token');

      const error = {
        isAxiosError: true,
        response: { status: 500 },
        message: 'Internal Server Error',
      };

      await expect(
        apiClient.interceptors.response.handlers[0].rejected(error)
      ).rejects.toEqual(error);

      expect(clearAuthToken).not.toHaveBeenCalled();
      expect(notifyAuthSessionExpired).not.toHaveBeenCalled();
    });
  });
});