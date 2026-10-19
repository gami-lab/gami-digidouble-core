import {
  createApiError,
  isApiResponseEnvelope,
  normalizeApiUrl,
  resolveApiUrl,
  type CreateUrlMediaAssetRequest,
  type ListMediaAssetsResponse,
  type MediaAssetResponse,
  type MediaAssetSummary,
  type UpdateMediaAssetRequest,
} from '@gami/shared'
import { apiUrl } from '../env'
import { ApiError, adminRequest, notifySignedOut } from './client'

export type { MediaAssetSummary }

export async function listMediaAssets(scenarioId: string): Promise<MediaAssetSummary[]> {
  const payload = await adminRequest<ListMediaAssetsResponse>(
    'GET',
    `/v1/admin/scenarios/${scenarioId}/media`,
  )
  return payload.assets
}

export async function createUrlMediaAsset(
  scenarioId: string,
  input: CreateUrlMediaAssetRequest,
): Promise<MediaAssetSummary> {
  const payload = await adminRequest<MediaAssetResponse>(
    'POST',
    `/v1/admin/scenarios/${scenarioId}/media`,
    input,
  )
  return payload.asset
}

export async function updateMediaAsset(
  assetId: string,
  input: UpdateMediaAssetRequest,
): Promise<MediaAssetSummary> {
  const payload = await adminRequest<MediaAssetResponse>(
    'PATCH',
    `/v1/admin/media/${assetId}`,
    input,
  )
  return payload.asset
}

export async function deleteMediaAsset(assetId: string): Promise<void> {
  await adminRequest('DELETE', `/v1/admin/media/${assetId}`)
}

export type UploadMediaInput = {
  file: Blob
  description: string
  cueable: boolean
  posterAssetId?: string
  durationMs?: number
}

/** Uploads the raw file; XHR rather than fetch so the browser reports upload progress. */
export function uploadMediaAsset(
  scenarioId: string,
  input: UploadMediaInput,
  onProgress: (fraction: number) => void = () => undefined,
): Promise<MediaAssetSummary> {
  const query = new URLSearchParams({
    description: input.description,
    cueable: String(input.cueable),
    ...(input.posterAssetId !== undefined ? { posterAssetId: input.posterAssetId } : {}),
    ...(input.durationMs !== undefined ? { durationMs: String(input.durationMs) } : {}),
  })
  const url = `${normalizeApiUrl(apiUrl)}/v1/admin/scenarios/${scenarioId}/media/upload?${query.toString()}`
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', url)
    request.withCredentials = true
    request.setRequestHeader('Content-Type', input.file.type)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onerror = () => {
      reject(new ApiError('NETWORK_ERROR', 'Upload failed: network error'))
    }
    request.onload = () => {
      const payload = parseJson(request.responseText)
      if (!isApiResponseEnvelope<MediaAssetResponse>(payload)) {
        reject(new ApiError('NETWORK_ERROR', `Upload failed with status ${String(request.status)}`))
        return
      }
      if (payload.error !== null) {
        if (request.status === 401) notifySignedOut()
        reject(createApiError(payload.error))
        return
      }
      resolve(payload.data.asset)
    }
    request.send(input.file)
  })
}

/** The URL an `<img>` or `<video>` in admin previews the asset from. */
export function mediaSrc(asset: Pick<MediaAssetSummary, 'previewUrl'>): string {
  return resolveApiUrl(asset.previewUrl, apiUrl)
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
