import type { MediaKind, MediaRef, MediaSource } from '@gami/shared'

/**
 * A scenario-scoped image or video. Uploads are stored behind `IMediaStorage` under a
 * Core-generated `storageKey`; URL assets keep only their `url`.
 */
export type MediaAsset = {
  assetId: MediaRef
  scenarioId: string
  kind: MediaKind
  source: MediaSource
  storageKey: string | null
  url: string | null
  mimeType: string
  byteSize: number | null
  posterAssetId: MediaRef | null
  durationMs: number | null
  description: string
  cueable: boolean
  createdAt: string
  updatedAt: string
}
