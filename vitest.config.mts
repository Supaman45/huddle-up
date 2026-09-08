import { defineConfig } from 'vitest/config';

// The suite covers pure logic only: what a parent sees, and how dates and stats are
// summarized. Component rendering needs a React Native test renderer and belongs in a
// later pass; testing the decisions is what catches the bugs that reach a phone.
export default defineConfig({
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
