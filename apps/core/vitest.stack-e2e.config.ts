import { defineConfig } from 'vitest/config'

// Stack E2E test suite.
//
// Tests in this tier fire real HTTP requests against a running Docker stack
// (postgres + redis + app built from the production Dockerfile). They are
// executed by the nightly CI job after `docker compose -f docker-compose.e2e.yml
// up --wait` has confirmed all services are healthy.
//
// Unlike *.e2e.test.ts (which use Fastify inject() in-process), these tests
// exercise the full production binary over the network — including real DB
// connections, real Redis, and optionally real LLM providers.
//
// File naming convention: *.stack-e2e.test.ts
//
// Required env var: APP_URL (defaults to http://localhost:3000)
// Auth key expected by tests: e2e-stack-secret (matches docker-compose.e2e.yml)
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.stack-e2e.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Real network calls to a running container can be slow
    testTimeout: 60_000,
    hookTimeout: 15_000,
  },
})
