import { describe, expect, it, vi } from 'vitest'
import {
  GradiumVoiceCatalog,
  type GradiumVoiceListRequest,
  type GradiumVoiceListTransport,
} from './gradium-voice-catalog.js'

const CONFIG = {
  apiKey: 'gradium-secret-test',
  baseUrl: 'https://gradium.test/api',
  timeoutMs: 5_000,
}

function gradiumVoice(
  uid: string,
  name: string,
  language: string,
  isCatalog = true,
  gender?: string,
): Record<string, unknown> {
  return {
    uid,
    name,
    language,
    description: `${name} voice`,
    is_catalog: isCatalog,
    tags: gender === undefined ? [] : [{ category: 'gender', value: gender }],
  }
}

function createTransport(pages: unknown[][], status = 200): ReturnType<typeof vi.fn> {
  return vi
    .fn<GradiumVoiceListTransport>()
    .mockImplementation((request: GradiumVoiceListRequest) => {
      const skip = Number(new URL(request.url).searchParams.get('skip'))
      const page = pages[skip / 100] ?? []
      return Promise.resolve({ status, json: () => Promise.resolve(page) })
    })
}

describe('GradiumVoiceCatalog', () => {
  it('lists account voices before catalog voices, mapped to provider-neutral options', async () => {
    const transport = createTransport([
      [
        gradiumVoice('cat_fr', 'Claude', 'fr', true, 'male'),
        gradiumVoice('own_fr', 'Emma chalet', 'fr', false),
      ],
    ])
    const catalog = new GradiumVoiceCatalog(CONFIG, transport)

    await expect(catalog.list()).resolves.toEqual([
      { voiceId: 'own_fr', name: 'Emma chalet', language: 'fr', description: 'Emma chalet voice' },
      {
        voiceId: 'cat_fr',
        name: 'Claude',
        language: 'fr',
        description: 'Claude voice',
        gender: 'male',
      },
    ])
    const request = transport.mock.calls[0]?.[0] as GradiumVoiceListRequest
    expect(request.url).toBe(
      'https://gradium.test/api/voices/?include_catalog=true&skip=0&limit=100',
    )
    expect(request.headers).toEqual({ 'x-api-key': 'gradium-secret-test' })
  })

  it('follows pagination until a short page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      gradiumVoice(`voice_${String(index)}`, `Voice ${String(index)}`, 'en'),
    )
    const transport = createTransport([firstPage, [gradiumVoice('voice_last', 'Zed', 'en')]])

    const voices = await new GradiumVoiceCatalog(CONFIG, transport).list()

    expect(voices).toHaveLength(101)
    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('filters by primary language subtag and picks the first catalog voice as default', async () => {
    const transport = createTransport([
      [
        gradiumVoice('own_fr', 'Aaron custom', 'fr', false),
        gradiumVoice('cat_fr_b', 'Bastien', 'fr'),
        gradiumVoice('cat_fr_a', 'Apolline', 'fr'),
        gradiumVoice('cat_en', 'Harper', 'en'),
      ],
    ])
    const catalog = new GradiumVoiceCatalog(CONFIG, transport)

    expect((await catalog.list('fr-CH')).map((voice) => voice.voiceId)).toEqual([
      'own_fr',
      'cat_fr_a',
      'cat_fr_b',
    ])
    await expect(catalog.getDefaultVoiceId('fr-CH')).resolves.toBe('cat_fr_a')
    await expect(catalog.getDefaultVoiceId('pt')).resolves.toBe('cat_fr_a')
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('refreshes the cached list after it expires', async () => {
    let now = 0
    const transport = createTransport([[gradiumVoice('cat_en', 'Harper', 'en')]])
    const catalog = new GradiumVoiceCatalog(CONFIG, transport, () => now)

    await catalog.list()
    now = 10 * 60_000 + 1
    await catalog.list()

    expect(transport).toHaveBeenCalledTimes(2)
  })

  it('maps rejected credentials to invalid configuration and does not cache failures', async () => {
    const transport = createTransport([[]], 401)
    const catalog = new GradiumVoiceCatalog(CONFIG, transport)

    await expect(catalog.list()).rejects.toMatchObject({
      failure: { code: 'invalid_configuration', reason: 'invalid_adapter_configuration' },
    })
    await expect(catalog.list()).rejects.toMatchObject({
      failure: { code: 'invalid_configuration' },
    })
    expect(transport).toHaveBeenCalledTimes(2)
  })
})
