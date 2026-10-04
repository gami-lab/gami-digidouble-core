import type { ListVoicesResponse } from '@gami/shared'
import { adminRequest } from './client'

export async function listVoices(language?: string): Promise<ListVoicesResponse> {
  const query = language === undefined ? '' : `?language=${encodeURIComponent(language)}`
  return adminRequest<ListVoicesResponse>('GET', `/v1/admin/voices${query}`)
}
