import { describe, expect, it } from 'vitest'
import { mapAvatarOverride, mapModelConfigFormToRequest } from './model-config-contract-mappers.js'

describe('model config contract mappers', () => {
  it('maps and trims model-config overrides while omitting empty values', () => {
    expect(
      mapModelConfigFormToRequest({
        globalDefault: { provider: 'openai', model: 'gpt-5.6-luna' },
        roleOverrides: {
          avatar: { provider: ' anthropic ', model: ' claude-sonnet-4-6 ' },
          gameMaster: { provider: '', model: '' },
          memory: { provider: 'xai', model: ' ' },
        },
      }),
    ).toEqual({
      globalDefault: { provider: 'openai', model: 'gpt-5.6-luna' },
      roleOverrides: {
        avatar: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        memory: { provider: 'xai' },
      },
    })
  })

  it('maps Avatar overrides with null clearing and partial-value preservation', () => {
    expect(mapAvatarOverride({ provider: ' openai ', model: ' gpt-5.6-luna ' })).toEqual({
      provider: 'openai',
      model: 'gpt-5.6-luna',
    })
    expect(mapAvatarOverride({ provider: '', model: '' })).toBeNull()
    expect(mapAvatarOverride({ provider: 'openai', model: '' })).toEqual({
      provider: 'openai',
      model: '',
    })
  })
})
