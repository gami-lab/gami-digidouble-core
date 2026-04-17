/**
 * Integration test — real Langfuse API.
 *
 * Sends a trace to the configured Langfuse instance and verifies the SDK
 * does not throw. The trace will appear in the Langfuse dashboard under the
 * name "integration-test" for manual verification.
 *
 * Skipped automatically when LANGFUSE_SECRET_KEY is absent.
 */
import { describe, expect, it } from 'vitest'
import { LangfuseObservabilityAdapter } from './langfuse.adapter.js'

const secretKey = process.env['LANGFUSE_SECRET_KEY']
const publicKey = process.env['LANGFUSE_PUBLIC_KEY']
const host = process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com'

describe.skipIf(!secretKey || !publicKey)(
  'LangfuseObservabilityAdapter — real API integration',
  () => {
    it('sends a trace and flushes without error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const adapter = new LangfuseObservabilityAdapter(publicKey!, secretKey!, host)

      await adapter.trace({
        requestId: `integration-test-${Date.now().toString()}`,
        event: 'integration-test',
        latencyMs: 42,
        inputTokens: 10,
        outputTokens: 5,
        metadata: { source: 'vitest-integration' },
      })

      // flush() sends buffered events to Langfuse and shuts down the SDK client
      await expect(adapter.flush()).resolves.toBeUndefined()
    }, 30_000)
  },
)
