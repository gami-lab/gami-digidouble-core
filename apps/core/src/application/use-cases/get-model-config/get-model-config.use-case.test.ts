import { describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import { GetModelConfigUseCase } from './get-model-config.use-case.js'

describe('GetModelConfigUseCase', () => {
  it('returns persisted config when repository has one', async () => {
    const persisted: ModelConfig = {
      globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
      roleOverrides: { memory: { provider: 'mistral', model: 'mistral-small-latest' } },
      updatedAt: '2026-05-20T00:00:00.000Z',
    }
    const repository = {
      get: vi.fn().mockResolvedValue(persisted),
      upsert: vi.fn(),
    }

    const useCase = new GetModelConfigUseCase(repository)
    const output = await useCase.execute()

    expect(repository.get).toHaveBeenCalledTimes(1)
    expect(output.modelConfig).toEqual(persisted)
  })

  it('uses injected runtime fallback when repository returns null', async () => {
    const fallback: ModelConfig = {
      globalDefault: { provider: 'anthropic', model: '' },
      roleOverrides: {},
      updatedAt: '2026-05-20T00:00:00.000Z',
    }
    const repository = {
      get: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    }

    const useCase = new GetModelConfigUseCase(repository, fallback)
    const output = await useCase.execute()

    expect(output.modelConfig).toEqual(fallback)
  })
})
