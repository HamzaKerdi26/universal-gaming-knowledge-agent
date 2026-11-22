import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    setupFiles: ['src/utils/setup.ts'],
    transformMode: {
      web: [/\.[jt]sx?/],
    },
  },
});