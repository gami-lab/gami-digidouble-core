import type { VoiceOption } from '@gami/shared'
import { TextToSpeechError } from '../../application/ports/ITextToSpeechAdapter.js'
import { createTimeoutSignal } from './timeout-signal.js'

const PAGE_SIZE = 100
const MAX_PAGES = 20
const CACHE_TTL_MS = 10 * 60_000

export type GradiumVoiceListRequest = Readonly<{
  url: string
  headers: Readonly<{ 'x-api-key': string }>
  signal: AbortSignal
}>

export type GradiumVoiceListResponse = Readonly<{ status: number; json: () => Promise<unknown> }>

export type GradiumVoiceListTransport = (
  request: GradiumVoiceListRequest,
) => Promise<GradiumVoiceListResponse>

export const fetchGradiumVoiceList: GradiumVoiceListTransport = (request) =>
  fetch(request.url, { method: 'GET', headers: request.headers, signal: request.signal })

type CatalogVoice = VoiceOption & { isCatalog: boolean }

type GradiumVoiceCatalogConfig = Readonly<{
  apiKey: string
  /** e.g. `https://api.gradium.ai/api` */
  baseUrl: string
  timeoutMs: number
}>

/**
 * Account voices (custom first, then Gradium's catalog), cached for a few minutes. The default
 * voice is the first catalog voice in the requested language, else the first catalog voice.
 */
export class GradiumVoiceCatalog {
  private cache: { voices: CatalogVoice[]; expiresAt: number } | null = null
  private inFlight: Promise<CatalogVoice[]> | null = null

  constructor(
    private readonly config: GradiumVoiceCatalogConfig,
    private readonly transport: GradiumVoiceListTransport = fetchGradiumVoiceList,
    private readonly now: () => number = Date.now,
  ) {}

  async list(language?: string): Promise<VoiceOption[]> {
    const voices = await this.load()
    return voices
      .filter((voice) => matchesLanguage(voice.language, language))
      .map(({ isCatalog: _isCatalog, ...voice }) => voice)
  }

  async getDefaultVoiceId(language?: string): Promise<string | undefined> {
    const catalog = (await this.load()).filter((voice) => voice.isCatalog)
    const inLanguage = catalog.find((voice) => matchesLanguage(voice.language, language))
    return (inLanguage ?? catalog[0])?.voiceId
  }

  private async load(): Promise<CatalogVoice[]> {
    if (this.cache !== null && this.cache.expiresAt > this.now()) return this.cache.voices
    this.inFlight ??= this.fetchAll().finally(() => {
      this.inFlight = null
    })
    const voices = await this.inFlight
    this.cache = { voices, expiresAt: this.now() + CACHE_TTL_MS }
    return voices
  }

  private async fetchAll(): Promise<CatalogVoice[]> {
    const voices: CatalogVoice[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const batch = await this.fetchPage(page * PAGE_SIZE)
      voices.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }
    return voices.sort(
      (a, b) => Number(a.isCatalog) - Number(b.isCatalog) || a.name.localeCompare(b.name),
    )
  }

  private async fetchPage(skip: number): Promise<CatalogVoice[]> {
    const url = `${this.config.baseUrl}/voices/?include_catalog=true&skip=${String(skip)}&limit=${String(PAGE_SIZE)}`
    const timeout = createTimeoutSignal(undefined, this.config.timeoutMs)
    try {
      const response = await this.transport({
        url,
        headers: { 'x-api-key': this.config.apiKey },
        signal: timeout.signal,
      })
      if (response.status === 401 || response.status === 403) {
        throw new TextToSpeechError({
          code: 'invalid_configuration',
          reason: 'invalid_adapter_configuration',
          retryable: false,
        })
      }
      if (response.status < 200 || response.status >= 300) {
        throw new TextToSpeechError({ code: 'provider_unavailable', retryable: true })
      }
      const body = await response.json()
      if (!Array.isArray(body)) {
        throw new TextToSpeechError({
          code: 'invalid_provider_output',
          reason: 'malformed_body',
          retryable: false,
        })
      }
      return body.flatMap(toCatalogVoice)
    } catch (error) {
      if (error instanceof TextToSpeechError) throw error
      if (timeout.timedOut()) throw new TextToSpeechError({ code: 'timeout', retryable: true })
      throw new TextToSpeechError({ code: 'provider_unavailable', retryable: true })
    } finally {
      timeout.clear()
    }
  }
}

function toCatalogVoice(raw: unknown): CatalogVoice[] {
  if (typeof raw !== 'object' || raw === null) return []
  const record = raw as Record<string, unknown>
  const voiceId = record['uid']
  const name = record['name']
  if (typeof voiceId !== 'string' || voiceId.length === 0 || typeof name !== 'string') return []
  const gender = readTag(record['tags'], 'gender')
  return [
    {
      voiceId,
      name,
      ...optionalText('language', record['language']),
      ...optionalText('description', record['description']),
      ...(gender !== undefined ? { gender } : {}),
      isCatalog: record['is_catalog'] === true,
    },
  ]
}

function optionalText<K extends string>(key: K, value: unknown): Partial<Record<K, string>> {
  return typeof value === 'string' && value.length > 0
    ? ({ [key]: value } as Record<K, string>)
    : {}
}

function readTag(tags: unknown, category: string): string | undefined {
  if (!Array.isArray(tags)) return undefined
  for (const tag of tags) {
    if (typeof tag !== 'object' || tag === null) continue
    const record = tag as Record<string, unknown>
    if (record['category'] === category && typeof record['value'] === 'string') {
      return record['value']
    }
  }
  return undefined
}

/** `fr-CH` matches `fr`; no requested language matches everything. */
function matchesLanguage(
  voiceLanguage: string | undefined,
  requested: string | undefined,
): boolean {
  if (requested === undefined) return true
  if (voiceLanguage === undefined) return false
  return primarySubtag(voiceLanguage) === primarySubtag(requested)
}

function primarySubtag(language: string): string {
  return language.split('-')[0]?.toLowerCase() ?? ''
}
