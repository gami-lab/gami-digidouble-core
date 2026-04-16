import { describe, expect, it } from 'vitest'
import { OpenAiAdapter } from './openai.adapter.js'

const apiKey = process.env['OPENAI_API_KEY']

describe.skipIf(!apiKey)('OpenAiAdapter — real gpt-4o-mini integration', () => {
  it('returns a valid LlmResponse from the live API', async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const adapter = new OpenAiAdapter(apiKey!)

    const response = await adapter.complete({
      systemPrompt: 'You are a concise assistant. Reply with a single word.',
      messages: [{ role: 'user', content: 'Say "ok".' }],
      model: 'gpt-4o-mini',
    })

    expect(response.content).toBeTruthy()
    expect(response.model).toContain('gpt-4o-mini')
    expect(response.inputTokens).toBeGreaterThan(0)
    expect(response.outputTokens).toBeGreaterThan(0)
    expect(response.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})
