import { defineConfig } from 'vitest/config'

// Unit-tests only — no real network, no LLM calls, always fast.
// Integration and E2E tests live in vitest.integration.config.ts and run only
// on the extended CI gate (push to main) and in nightly jobs.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'src/**/*.e2e.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        'src/**/*.e2e.test.ts',
        // Entry point wired at runtime — not unit-testable
        'src/index.ts',
        // Pure TypeScript type/interface files — no executable code
        'src/**/*.types.ts',
        'src/application/ports/**',
        'src/infrastructure/cache/**',
        'src/infrastructure/db/**',
        // Test helper utilities — not production code
        'src/test-utils/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ['text', 'lcov'],
    },
  },
})
