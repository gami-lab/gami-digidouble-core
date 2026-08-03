import { describe, expect, it } from 'vitest'
import type { ModelConfig } from './model-config.types.js'
import { ModelResolutionService } from './model-resolution.service.js'

const baseConfig: ModelConfig = {
  globalDefault: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
  },
  roleOverrides: {},
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('ModelResolutionService.resolve -> no overrides', () => {
  it('returns global default for avatar, gameMaster, and memory', () => {
    expect(ModelResolutionService.resolve('avatar', baseConfig)).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
    })

    expect(ModelResolutionService.resolve('gameMaster', baseConfig)).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
    })

    expect(ModelResolutionService.resolve('memory', baseConfig)).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
    })
  })
})

describe('ModelResolutionService.resolve -> role overrides', () => {
  it('applies gameMaster role override while avatar stays on global default', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: {
        gameMaster: {
          provider: 'anthropic',
          model: 'claude-3-7-sonnet',
        },
      },
    }

    expect(ModelResolutionService.resolve('gameMaster', config)).toEqual({
      provider: 'anthropic',
      model: 'claude-3-7-sonnet',
    })

    expect(ModelResolutionService.resolve('avatar', config)).toEqual({
      provider: 'openai',
      model: 'gpt-4.1-mini',
    })
  })
})

describe('ModelResolutionService.resolve -> avatar overrides', () => {
  it('applies a session override consistently to every model role', () => {
    const sessionOverride = {
      provider: 'openai' as const,
      model: 'gpt-5.6-luna',
      serviceTier: 'fast' as const,
    }

    expect(ModelResolutionService.resolve('avatar', baseConfig, { sessionOverride })).toEqual(
      sessionOverride,
    )
    expect(ModelResolutionService.resolve('gameMaster', baseConfig, { sessionOverride })).toEqual(
      sessionOverride,
    )
    expect(ModelResolutionService.resolve('memory', baseConfig, { sessionOverride })).toEqual(
      sessionOverride,
    )
  })

  it('gives an explicit request override highest precedence for the Avatar role', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: { avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' } },
    }

    expect(
      ModelResolutionService.resolve('avatar', config, {
        avatarOverride: { provider: 'xai', model: 'grok-4.3' },
        requestOverride: { provider: 'openai', model: 'gpt-5.4-mini' },
      }),
    ).toEqual({ provider: 'openai', model: 'gpt-5.4-mini' })
  })

  it('preserves a request-level Fast service tier for the Avatar role', () => {
    expect(
      ModelResolutionService.resolve('avatar', baseConfig, {
        requestOverride: { provider: 'openai', model: 'gpt-5.6-luna', serviceTier: 'fast' },
      }),
    ).toEqual({ provider: 'openai', model: 'gpt-5.6-luna', serviceTier: 'fast' })
  })

  it('uses avatar override provider and falls back model to lower precedence', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: {
        avatar: {
          provider: 'mistral',
          model: 'mistral-large',
        },
      },
    }

    expect(
      ModelResolutionService.resolve('avatar', config, {
        avatarOverride: {
          provider: 'xai',
        },
      }),
    ).toEqual({
      provider: 'xai',
      model: 'mistral-large',
    })
  })

  it('uses avatar override model and falls back provider to lower precedence', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: {
        avatar: {
          provider: 'anthropic',
        },
      },
    }

    expect(
      ModelResolutionService.resolve('avatar', config, {
        avatarOverride: {
          model: 'claude-3-5-haiku',
        },
      }),
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-3-5-haiku',
    })
  })

  it('ignores avatar override for non-avatar roles', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: {
        gameMaster: {
          provider: 'mistral',
          model: 'mistral-small',
        },
      },
    }

    expect(
      ModelResolutionService.resolve('gameMaster', config, {
        avatarOverride: {
          provider: 'xai',
          model: 'grok-3',
        },
      }),
    ).toEqual({
      provider: 'mistral',
      model: 'mistral-small',
    })
  })
})

describe('ModelResolutionService.resolve -> null provider default', () => {
  it('resolves null provider and empty model from global default without error', () => {
    const config: ModelConfig = {
      globalDefault: {
        provider: 'null',
        model: '',
      },
      roleOverrides: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    expect(ModelResolutionService.resolve('memory', config)).toEqual({
      provider: 'null',
      model: '',
    })
  })
})

describe('ModelResolutionService.resolve -> scenario model selection', () => {
  it('uses scenario default for avatar when no avatar override is present', () => {
    expect(
      ModelResolutionService.resolve('avatar', baseConfig, {
        scenarioModelSelection: {
          defaultProfile: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
          },
        },
      }),
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    })
  })

  it('gives avatar override precedence over scenario default', () => {
    expect(
      ModelResolutionService.resolve('avatar', baseConfig, {
        avatarOverride: {
          provider: 'mistral',
          model: 'mistral-small-4',
        },
        scenarioModelSelection: {
          defaultProfile: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
          },
        },
      }),
    ).toEqual({
      provider: 'mistral',
      model: 'mistral-small-4',
    })
  })

  it('uses Game Master override before scenario default and global config', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: {
        gameMaster: {
          provider: 'mistral',
          model: 'mistral-medium-3.5',
        },
      },
    }

    expect(
      ModelResolutionService.resolve('gameMaster', config, {
        scenarioModelSelection: {
          defaultProfile: {
            provider: 'openai',
            model: 'gpt-5.4-mini',
          },
          gameMasterOverride: {
            provider: 'anthropic',
            model: 'claude-opus-4-7',
          },
        },
      }),
    ).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-4-7',
    })
  })
})

describe('ModelResolutionService.resolve -> memory scenario model selection', () => {
  it('uses scenario default for memory when no memoryOverride is present', () => {
    expect(
      ModelResolutionService.resolve('memory', baseConfig, {
        scenarioModelSelection: {
          defaultProfile: {
            provider: 'xai',
            model: 'grok-4.3',
          },
        },
      }),
    ).toEqual({
      provider: 'xai',
      model: 'grok-4.3',
    })
  })

  it('uses memoryOverride before scenario default and global config', () => {
    const config: ModelConfig = {
      ...baseConfig,
      roleOverrides: {
        memory: {
          provider: 'mistral',
          model: 'mistral-medium-3.5',
        },
      },
    }

    expect(
      ModelResolutionService.resolve('memory', config, {
        scenarioModelSelection: {
          defaultProfile: {
            provider: 'openai',
            model: 'gpt-5.4-mini',
          },
          memoryOverride: {
            provider: 'xai',
            model: 'grok-4.3',
          },
        },
      }),
    ).toEqual({
      provider: 'xai',
      model: 'grok-4.3',
    })
  })
})
