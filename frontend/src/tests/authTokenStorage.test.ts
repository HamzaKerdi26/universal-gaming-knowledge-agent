import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthToken, storeAuthToken, clearAuthToken, AUTH_SESSION_EXPIRED_EVENT } from '../services/authTokenStorage';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe('authTokenStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuthToken', () => {
    it('should return token from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('test-token');
      const token = getAuthToken();
      expect(token).toBe('test-token');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('ugka_access_token');
    });

    it('should return null when no token in localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      const token = getAuthToken();
      expect(token).toBeNull();
    });

    it('should return null on localStorage error', () => {
      mockLocalStorage.getItem.mockImplementation(() => { throw new Error('Storage error'); });
      const token = getAuthToken();
      expect(token).toBeNull();
    });
  });

  describe('storeAuthToken', () => {
    it('should store token in localStorage and return true', () => {
      const result = storeAuthToken('test-token');
      expect(result).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('ugka_access_token', 'test-token');
    });

    it('should return false on localStorage error', () => {
      mockLocalStorage.setItem.mockImplementation(() => { throw new Error('Storage error'); });
      const result = storeAuthToken('test-token');
      expect(result).toBe(false);
    });
  });

  describe('clearAuthToken', () => {
    it('should remove token from localStorage', () => {
      clearAuthToken();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('ugka_access_token');
    });

    it('should not throw on localStorage error', () => {
      mockLocalStorage.removeItem.mockImplementation(() => { throw new Error('Storage error'); });
      expect(() => clearAuthToken()).not.toThrow();
    });
  });

  describe('AUTH_SESSION_EXPIRED_EVENT', () => {
    it('should have correct event name', () => {
      expect(AUTH_SESSION_EXPIRED_EVENT).toBe('ugka:auth-session-expired');
    });
  });
});