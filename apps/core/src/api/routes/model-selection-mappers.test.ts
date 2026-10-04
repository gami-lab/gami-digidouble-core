import { describe, expect, it } from 'vitest'
import { mapCreateScenarioInput, mapUpdateScenarioInput } from './model-selection-mappers.js'

describe('scenario model-selection mappers', () => {
  it('normalizes all scenario model profiles by trimming models', () => {
    expect(
      mapCreateScenarioInput({
        name: 'Scenario',
        modelSelection: {
          defaultProfile: { provider: 'openai', model: ' gpt-5.6-luna ' },
          avatarOverride: { provider: 'mistral', model: ' mistral-small-4 ' },
          gameMasterOverride: { provider: 'anthropic', model: ' claude-sonnet-4-6 ' },
          memoryOverride: { provider: 'xai', model: ' grok-4.3 ' },
        },
      }),
    ).toMatchObject({
      modelSelection: {
        defaultProfile: { provider: 'openai', model: 'gpt-5.6-luna' },
        avatarOverride: { provider: 'mistral', model: 'mistral-small-4' },
        gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        memoryOverride: { provider: 'xai', model: 'grok-4.3' },
      },
    })
  })

  it('normalizes new fields on update while preserving the scenario id', () => {
    expect(
      mapUpdateScenarioInput('scenario_1', {
        modelSelection: {
          avatarOverride: { provider: 'mistral', model: ' mistral-small-4 ' },
          memoryOverride: { provider: 'xai', model: ' grok-4.3 ' },
        },
      }),
    ).toEqual({
      scenarioId: 'scenario_1',
      modelSelection: {
        avatarOverride: { provider: 'mistral', model: 'mistral-small-4' },
        memoryOverride: { provider: 'xai', model: 'grok-4.3' },
      },
    })
  })
})
