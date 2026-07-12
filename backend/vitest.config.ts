const { defineConfig } = require('vitest/config');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'src/server.ts',
        // Declarative route wiring and Mongoose schema registration contain no
        // independently testable business behavior; their contracts and indexes
        // are verified by dedicated tests instead.
        'src/routes.ts',
        'src/model/**',
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
