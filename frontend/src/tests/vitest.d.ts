// Vitest global types
import '@testing-library/jest-dom';

declare module 'vitest' {
  interface ProvidedContext {
    type: string;
  }
}

// Extend Vitest's assertion types to include jest-dom matchers
declare module 'vitest' {
  interface Assertion<T = any> extends jest.Matchers<void, T> {}
  interface AsymmetricMatchersContaining extends jest.Matchers<void, any> {}
}