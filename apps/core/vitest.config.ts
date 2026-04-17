import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.integration.test.ts',
        // Entry point wired at runtime — not unit-testable
        'src/index.ts',
        // Pure TypeScript type/interface files — no executable code
        'src/**/*.types.ts',
        'src/application/ports/**',
        'src/infrastructure/cache/**',
        'src/infrastructure/db/**',
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
