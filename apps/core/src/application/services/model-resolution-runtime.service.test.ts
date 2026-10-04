import { describe, expect, it, vi } from 'vitest'
import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import { LlmError } from '../../infrastructure/llm/llm.error.js'
import {
  resolveRoleLlmCall,
  resolveTraitPreparationLlmCall,
} from './model-resolution-runtime.service.js'

describe('resolveRoleLlmCall', () => {
  it('uses a request-level Avatar model override before persisted configuration', async () => {
    const defaultAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const selectedAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'gpt-5.6-luna' },
        roleOverrides: { avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue(selectedAdapter) }

    await expect(
      resolveRoleLlmCall({
        role: 'avatar',
        defaultAdapter,
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        avatarOverride: { provider: 'xai', model: 'grok-4.3' },
        requestOverride: { provider: 'mistral', model: 'mistral-small-4' },
        scenarioModelSelection: undefined,
      }),
    ).resolves.toEqual({
      adapter: selectedAdapter,
      provider: 'mistral',
      model: 'mistral-small-4',
      effectiveModel: 'mistral-small-4',
    })
    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('mistral')
  })

  it('throws a clear role-scoped error when provider adapter is unavailable', async () => {
    const defaultAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'null', model: '' },
        roleOverrides: { avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = {
      get: vi.fn().mockImplementation(() => {
        throw new LlmError('anthropic', 'LLM provider anthropic is not configured', 503)
      }),
    }

    await expect(
      resolveRoleLlmCall({
        role: 'avatar',
        defaultAdapter,
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        avatarOverride: undefined,
        scenarioModelSelection: undefined,
      }),
    ).rejects.toMatchObject({
      message: "Provider 'anthropic' is configured for 'avatar' but no API key is available.",
      statusCode: 503,
    })
  })
})

describe('resolveTraitPreparationLlmCall', () => {
  it('uses the scenario default and ignores avatar-scoped overrides', async () => {
    const defaultAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const selectedAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'gpt-5.6-luna' },
        roleOverrides: { avatar: { provider: 'xai', model: 'grok-4.3' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue(selectedAdapter) }

    await expect(
      resolveTraitPreparationLlmCall({
        defaultAdapter,
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        scenarioModelSelection: {
          defaultProfile: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
          avatarOverride: { provider: 'mistral', model: 'mistral-small-4' },
        },
      }),
    ).resolves.toEqual({
      adapter: selectedAdapter,
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      effectiveModel: 'claude-sonnet-4-6',
    })
    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('anthropic')
  })

  it('uses the global default when no scenario selection exists', async () => {
    const defaultAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const selectedAdapter = { complete: vi.fn() } as unknown as ILlmAdapter
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'gpt-5.6-luna' },
        roleOverrides: { avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue(selectedAdapter) }

    await expect(
      resolveTraitPreparationLlmCall({
        defaultAdapter,
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        scenarioModelSelection: undefined,
      }),
    ).resolves.toEqual({
      adapter: selectedAdapter,
      provider: 'openai',
      model: 'gpt-5.6-luna',
      effectiveModel: 'gpt-5.6-luna',
    })
    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('openai')
  })

  it('names trait preparation, not the avatar role, when the provider key is missing', async () => {
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'gpt-5.6-luna' },
        roleOverrides: {},
        updatedAt: '2026-05-20T00:00:00.000Z',
      }),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = {
      get: vi.fn().mockImplementation(() => {
        throw new LlmError('anthropic', 'LLM provider anthropic is not configured', 503)
      }),
    }

    await expect(
      resolveTraitPreparationLlmCall({
        defaultAdapter: { complete: vi.fn() },
        modelConfigRepository,
        llmAdapterRegistry,
        modelConfigFallback: undefined,
        scenarioModelSelection: {
          defaultProfile: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      }),
    ).rejects.toMatchObject({
      message:
        "Provider 'anthropic' is configured for 'traitPreparation' but no API key is available.",
      statusCode: 503,
    })
  })
})
