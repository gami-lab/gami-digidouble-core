import { describe, expect, it } from 'vitest'
import { MistralAdapter } from './mistral.adapter.js'

const apiKey = process.env['MISTRAL_API_KEY']

describe.skipIf(!apiKey)('MistralAdapter — real mistral-small-latest integration', () => {
  it('returns a valid LlmResponse from the live API', async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const adapter = new MistralAdapter(apiKey!)

    const response = await adapter.complete({
      systemPrompt: 'You are a concise assistant. Reply with a single word.',
      messages: [{ role: 'user', content: 'Say "ok".' }],
      model: 'mistral-small-latest',
    })

    expect(response.content).toBeTruthy()
    expect(response.model).toContain('mistral')
    expect(response.inputTokens).toBeGreaterThan(0)
    expect(response.outputTokens).toBeGreaterThan(0)
    expect(response.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})
