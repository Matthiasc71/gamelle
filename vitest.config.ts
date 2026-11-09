import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // la simulation sur 52 semaines génère 52 menus
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
