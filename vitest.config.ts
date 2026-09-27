import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['tests/**', 'scripts/**', 'node_modules/**'],
  },
});
