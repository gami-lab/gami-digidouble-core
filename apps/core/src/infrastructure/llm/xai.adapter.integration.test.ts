import { describe, expect, it } from 'vitest'
import { XaiAdapter } from './xai.adapter.js'

const apiKey = process.env['XAI_API_KEY']

describe.skipIf(!apiKey)('XaiAdapter — real grok-3 integration', () => {
  it('returns a valid LlmResponse from the live API', async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const adapter = new XaiAdapter(apiKey!)

    const response = await adapter.complete({
      systemPrompt: 'You are a concise assistant. Reply with a single word.',
      messages: [{ role: 'user', content: 'Say "ok".' }],
      model: 'grok-3',
    })

    expect(response.content).toBeTruthy()
    expect(response.model.trim().length).toBeGreaterThan(0)
    expect(response.inputTokens).toBeGreaterThan(0)
    expect(response.outputTokens).toBeGreaterThan(0)
    expect(response.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})
