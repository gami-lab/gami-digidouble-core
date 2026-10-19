import { resolveApiUrl } from '@gami/shared'
import { apiUrl } from '../env'

/** Core sends uploaded-asset URLs relative to its API origin; URL assets arrive absolute. */
export function resolveMediaUrl(url: string): string {
  return resolveApiUrl(url, apiUrl)
}
