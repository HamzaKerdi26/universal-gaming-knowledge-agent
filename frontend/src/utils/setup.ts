// Setup file for vitest test environment
// Mocks for localStorage, axios, date utilities, etc.

// Mock localStorage
// Note: In jsdom, localStorage throws in certain contexts; we use Object.defineProperty
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock axios
const mockAxiosInstance = {
  interceptors: {
    request: {
      handlers: [] as { fulfilled: (config: any) => any }[],
      use: vi.fn((fn: (config: any) => any) => {
        mockAxiosInstance.interceptors.request.handlers.push({ fulfilled: fn });
        return 0;
      }),
    },
    response: {
      handlers: [] as { fulfilled: (config: any) => any; rejected: (error: any) => any }[],
      use: vi.fn((fulfilled: (config: any) => any, rejected: (error: any) => any) => {
        mockAxiosInstance.interceptors.response.handlers.push({ fulfilled, rejected });
        return 0;
      }),
    },
  },
  defaults: {
    baseURL: '',
    headers: {},
  },
};

vi.mock('axios', () => ({
  default: {
    isAxiosError: (error: any) => error?.isAxiosError === true,
    create: vi.fn((config) => {
      mockAxiosInstance.defaults = {
        baseURL: config.baseURL,
        headers: config.headers,
      };
      return mockAxiosInstance;
    }),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

// Mock date utilities
vi.mock('./src/utils/date', () => ({
  formatDate: vi.fn((date: string | null | undefined) => {
    if (!date) return "Unknown";
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }),
}));