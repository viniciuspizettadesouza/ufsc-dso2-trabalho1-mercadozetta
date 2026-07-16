const path = require('node:path');
const { defineConfig } = require('vitest/config');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['test/integration/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'src/server.ts',
        // Declarative route wiring and database schema registration contain no
        // independently testable business behavior; their generated SQL,
        // contracts, constraints, and indexes are verified by dedicated tests.
        'src/routes.ts',
        'src/database/schema.ts',
        'coverage/**',
        'node_modules/**',
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
  },
});
