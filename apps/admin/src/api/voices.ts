import type { ListVoicesResponse, TextToSpeechProviderName } from '@gami/shared'
import { adminRequest } from './client'

/** Voices of `provider`, else of Core's default text-to-speech provider. */
export async function listVoices(
  language?: string,
  provider?: TextToSpeechProviderName,
): Promise<ListVoicesResponse> {
  const params = new URLSearchParams()
  if (language !== undefined) params.set('language', language)
  if (provider !== undefined) params.set('provider', provider)
  const query = params.size === 0 ? '' : `?${params.toString()}`
  return adminRequest<ListVoicesResponse>('GET', `/v1/admin/voices${query}`)
}
