import { describe, expect, it } from 'vitest'
import { AnthropicAdapter } from './anthropic.adapter.js'

const apiKey = process.env['ANTHROPIC_API_KEY']

describe.skipIf(!apiKey)('AnthropicAdapter — real claude-3-haiku integration', () => {
  it('returns a valid LlmResponse from the live API', async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const adapter = new AnthropicAdapter(apiKey!)

    const response = await adapter.complete({
      systemPrompt: 'You are a concise assistant. Reply with a single word.',
      messages: [{ role: 'user', content: 'Say "ok".' }],
      model: 'claude-3-haiku-20240307',
    })

    expect(response.content).toBeTruthy()
    expect(response.model).toContain('claude-3-haiku')
    expect(response.inputTokens).toBeGreaterThan(0)
    expect(response.outputTokens).toBeGreaterThan(0)
    expect(response.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})
