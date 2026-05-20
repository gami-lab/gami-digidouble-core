import { describe, expect, it, vi } from 'vitest'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import { UpdateModelConfigUseCase } from './update-model-config.use-case.js'

describe('UpdateModelConfigUseCase', () => {
  it('normalizes model values and persists role overrides', async () => {
    const upsert = vi.fn((config: ModelConfig) => Promise.resolve(config))
    const repository: IModelConfigRepository = {
      get: vi.fn(),
      upsert,
    }

    const useCase = new UpdateModelConfigUseCase(repository)
    const output = await useCase.execute({
      globalDefault: { provider: 'openai', model: '  gpt-4.1-mini  ' },
      roleOverrides: {
        avatar: { model: ' gpt-4.1 ' },
        memory: { provider: 'xai', model: ' grok-2-mini ' },
      },
    })

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(output.modelConfig.globalDefault).toEqual({ provider: 'openai', model: 'gpt-4.1-mini' })
    expect(output.modelConfig.roleOverrides.avatar).toEqual({ model: 'gpt-4.1' })
    expect(output.modelConfig.roleOverrides.memory).toEqual({
      provider: 'xai',
      model: 'grok-2-mini',
    })
  })

  it('rejects unsupported providers', async () => {
    const useCase = new UpdateModelConfigUseCase({
      get: vi.fn(),
      upsert: vi.fn(),
    })

    await expect(
      useCase.execute({
        globalDefault: { provider: 'unsupported', model: 'gpt-4.1-mini' },
      }),
    ).rejects.toThrowError(/globalDefault\.provider must be one of/)
  })

  it('rejects model values longer than 200 chars', async () => {
    const useCase = new UpdateModelConfigUseCase({
      get: vi.fn(),
      upsert: vi.fn(),
    })

    await expect(
      useCase.execute({
        globalDefault: { provider: 'openai', model: 'x'.repeat(201) },
      }),
    ).rejects.toThrowError(/at most 200 characters/)
  })
})
