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
      globalDefault: { provider: 'openai', model: '  gpt-5.6-luna  ' },
      roleOverrides: {
        avatar: { model: ' gpt-5.6-sol ' },
        memory: { provider: 'xai', model: ' grok-4.3 ' },
      },
    })

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(output.modelConfig.globalDefault).toEqual({ provider: 'openai', model: 'gpt-5.6-luna' })
    expect(output.modelConfig.roleOverrides.avatar).toEqual({ model: 'gpt-5.6-sol' })
    expect(output.modelConfig.roleOverrides.memory).toEqual({
      provider: 'xai',
      model: 'grok-4.3',
    })
  })

  it('rejects unsupported providers', async () => {
    const useCase = new UpdateModelConfigUseCase({
      get: vi.fn(),
      upsert: vi.fn(),
    })

    await expect(
      useCase.execute({
        globalDefault: { provider: 'unsupported' as 'openai', model: 'gpt-5.6-luna' },
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

  it('rejects models outside the supported production matrix', async () => {
    const useCase = new UpdateModelConfigUseCase({
      get: vi.fn(),
      upsert: vi.fn(),
    })

    await expect(
      useCase.execute({
        globalDefault: { provider: 'openai', model: 'gpt-4o' },
      }),
    ).rejects.toThrowError(/supported production model matrix/)
  })
})
