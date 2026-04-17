import { defineConfig } from 'vitest/config'

// Integration and E2E test suite.
//
// Runs on the extended CI gate (push to main) and in nightly jobs — never in
// the fast PR gate.
//
// File naming conventions:
//   *.integration.test.ts — real adapter collaboration (may call live APIs;
//                           tests that require credentials use describe.skipIf)
//   *.e2e.test.ts         — full HTTP-stack flows through a running Fastify
//                           server (real LLM tests skipped via describe.skipIf
//                           when API keys are absent)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts', 'src/**/*.e2e.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
