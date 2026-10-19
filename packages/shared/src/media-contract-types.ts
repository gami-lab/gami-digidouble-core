/**
 * Scenario-scoped media assets (images and videos) referenced by presentation slots, avatar
 * triggers, and Game Master cues. Every reference is a `MediaRef` (the asset id); only Core builds
 * file URLs, and the player receives them already resolved as `PublicMediaAsset`.
 */

export const MEDIA_KINDS = ['image', 'video'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]

export const MEDIA_SOURCES = ['upload', 'url'] as const
export type MediaSource = (typeof MEDIA_SOURCES)[number]

/** A media asset id (`media_<id>`). */
export type MediaRef = string

export const MEDIA_REF_PATTERN = '^media_[A-Za-z0-9-]{1,64}$'

export const MEDIA_URL_PATTERN = '^https?://\\S+$'

export const MEDIA_LIMITS = {
  descriptionMaxLength: 500,
  urlMaxLength: 2048,
  durationMsMax: 6 * 60 * 60 * 1000,
  maxUploadBytes: {
    image: 10 * 1024 * 1024,
    video: 200 * 1024 * 1024,
  },
} as const satisfies {
  descriptionMaxLength: number
  urlMaxLength: number
  durationMsMax: number
  maxUploadBytes: Record<MediaKind, number>
}

export const MEDIA_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm'],
} as const satisfies Record<MediaKind, readonly string[]>

export type MediaMimeType = (typeof MEDIA_MIME_TYPES)[MediaKind][number]

/** Admin projection. `url` is the source URL for URL assets and `null` for uploads. */
export type MediaAssetSummary = {
  assetId: MediaRef
  scenarioId: string
  kind: MediaKind
  source: MediaSource
  mimeType: string
  byteSize: number | null
  url: string | null
  /** Where the player loads the asset from (Core's file route for uploads, the URL otherwise). */
  fileUrl: string
  /** Where admin previews the asset, whatever the scenario status (admin credential required). */
  previewUrl: string
  posterAssetId: MediaRef | null
  durationMs: number | null
  description: string
  cueable: boolean
  createdAt: string
  updatedAt: string
}

/** Player projection: everything needed to render the asset and nothing else. */
export type PublicMediaAsset = {
  assetId: MediaRef
  kind: MediaKind
  url: string
  posterUrl?: string
  durationMs?: number
  description: string
}

/** `POST /v1/admin/scenarios/{scenarioId}/media`: an asset hosted elsewhere. */
export type CreateUrlMediaAssetRequest = {
  url: string
  mimeType: MediaMimeType
  description: string
  cueable?: boolean
  posterAssetId?: MediaRef
  durationMs?: number
}

/**
 * Query of `POST /v1/admin/scenarios/{scenarioId}/media/upload`; the body is the raw file and its
 * `Content-Type` is the asset MIME type.
 */
export type UploadMediaAssetQuery = {
  description: string
  cueable?: 'true' | 'false'
  posterAssetId?: MediaRef
  durationMs?: string
}

/** `PATCH /v1/admin/media/{assetId}`; `null` clears the poster or duration. */
export type UpdateMediaAssetRequest = {
  description?: string
  cueable?: boolean
  posterAssetId?: MediaRef | null
  durationMs?: number | null
}

export type ListMediaAssetsResponse = { assets: MediaAssetSummary[] }
export type MediaAssetResponse = { asset: MediaAssetSummary }
export type DeleteMediaAssetResponse = { assetId: MediaRef; deleted: true }

/**
 * Avatar runtime triggers: media Core cues when the Avatar is unlocked or when the visitor switches
 * to it. They are runtime behavior, not presentation, so they live beside it.
 */
export type AvatarMediaTriggers = {
  onUnlock?: MediaRef
  onSwitchTo?: MediaRef
}

/** Create sends an object; update replaces the whole object, and `null` clears it. */
export type AvatarMediaTriggersUpdate = AvatarMediaTriggers | null

export const AVATAR_MEDIA_TRIGGER_SLOTS = {
  onUnlock: ['image', 'video'],
  onSwitchTo: ['image', 'video'],
} as const satisfies Record<keyof AvatarMediaTriggers, readonly MediaKind[]>

export function isAvatarMediaTriggers(value: unknown): value is AvatarMediaTriggers {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.entries(value).every(
    ([key, ref]) => key in AVATAR_MEDIA_TRIGGER_SLOTS && isMediaRef(ref),
  )
}

export function isMediaRef(value: unknown): value is MediaRef {
  return typeof value === 'string' && new RegExp(MEDIA_REF_PATTERN).test(value)
}

export function isMediaKind(value: unknown): value is MediaKind {
  return (MEDIA_KINDS as readonly unknown[]).includes(value)
}

/** The kind an allowed MIME type belongs to, or `null` when the type is not allowed. */
export function mediaKindForMimeType(mimeType: string): MediaKind | null {
  const normalized = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  return MEDIA_KINDS.find((kind) => isMimeTypeOfKind(normalized, kind)) ?? null
}

function isMimeTypeOfKind(mimeType: string, kind: MediaKind): boolean {
  return (MEDIA_MIME_TYPES[kind] as readonly string[]).includes(mimeType)
}
