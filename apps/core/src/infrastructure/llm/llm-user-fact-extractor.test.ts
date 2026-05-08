import { describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../application/ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import { LlmUserFactExtractor } from './llm-user-fact-extractor.js'
import { ObservedLlmAdapter } from './observed.adapter.js'

function createLlm(content: string): ILlmAdapter {
  return {
    complete: vi.fn(
      (_request: LlmRequest): Promise<LlmResponse> =>
        Promise.resolve({
          content,
          model: 'test-model',
          inputTokens: 10,
          outputTokens: 10,
          latencyMs: 5,
        }),
    ),
  }
}

const input = {
  userId: 'user_1',
  conversationId: 'conversation_1',
  messages: [{ role: 'user' as const, content: 'I prefer English' }],
}

describe('LlmUserFactExtractor', () => {
  it('returns facts for valid JSON response', async () => {
    const extractor = new LlmUserFactExtractor(
      createLlm('[{"category":"preference","key":"language","value":"english"}]'),
    )

    await expect(extractor.extract(input)).resolves.toEqual([
      { category: 'preference', key: 'language', value: 'english' },
    ])
  })

  it('parses response wrapped in markdown code fence', async () => {
    const extractor = new LlmUserFactExtractor(
      createLlm('```json\n[{"category":"goal","key":"career_goal","value":"promotion"}]\n```'),
    )

    await expect(extractor.extract(input)).resolves.toEqual([
      { category: 'goal', key: 'career_goal', value: 'promotion' },
    ])
  })

  it('returns empty array for empty response array', async () => {
    const extractor = new LlmUserFactExtractor(createLlm('[]'))

    await expect(extractor.extract(input)).resolves.toEqual([])
  })

  it('returns empty array for malformed JSON', async () => {
    const extractor = new LlmUserFactExtractor(createLlm('not json'))

    await expect(extractor.extract(input)).resolves.toEqual([])
  })

  it('returns at most 5 facts', async () => {
    const payload = JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({
        category: 'context',
        key: `key_${String(i)}`,
        value: `value_${String(i)}`,
      })),
    )
    const extractor = new LlmUserFactExtractor(createLlm(payload))

    const facts = await extractor.extract(input)
    expect(facts).toHaveLength(5)
  })

  it('filters facts missing required fields', async () => {
    const extractor = new LlmUserFactExtractor(
      createLlm(
        '[{"category":"preference","value":"english"},{"category":"preference","key":"language","value":"english"}]',
      ),
    )

    await expect(extractor.extract(input)).resolves.toEqual([
      { category: 'preference', key: 'language', value: 'english' },
    ])
  })

  it('returns empty array when LLM adapter throws', async () => {
    const llm: ILlmAdapter = {
      complete: vi.fn().mockRejectedValue(new Error('provider down')),
    }
    const extractor = new LlmUserFactExtractor(llm)

    await expect(extractor.extract(input)).resolves.toEqual([])
  })

  it('emits a trace when extractor uses an observed adapter', async () => {
    const base = createLlm('[{"category":"identity","key":"language","value":"english"}]')
    const observabilityTrace = vi.fn().mockResolvedValue(undefined)
    const observability: IObservabilityAdapter = {
      trace: observabilityTrace,
      flush: vi.fn().mockResolvedValue(undefined),
    }
    const extractor = new LlmUserFactExtractor(new ObservedLlmAdapter(base, observability))

    await expect(extractor.extract(input)).resolves.toEqual([
      { category: 'identity', key: 'language', value: 'english' },
    ])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(observabilityTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'llm.completion',
      }),
    )
  })
})
