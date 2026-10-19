import {
  AVATAR_MEDIA_TRIGGER_SLOTS,
  AVATAR_PRESENTATION_MEDIA_SLOTS,
  SCENARIO_PRESENTATION_MEDIA_SLOTS,
  mediaKindForMimeType,
  type AvatarMediaTriggers,
  type AvatarPresentation,
  type MediaAssetSummary,
  type MediaMimeType,
  type ScenarioPresentation,
} from '@gami/shared'

export type MediaSeedAsset = {
  /** Manifest-local name used by slots, triggers, and posters. */
  key: string
  description: string
  mimeType: MediaMimeType
  cueable?: boolean
  durationMs?: number
  /** Key of an image asset listed earlier in the manifest. */
  poster?: string
} & ({ url: string } | { file: string })

type SlotKeys<T extends object> = Partial<Record<keyof T, string>>

export type MediaSeedManifest = {
  assets: MediaSeedAsset[]
  scenario?: SlotKeys<typeof SCENARIO_PRESENTATION_MEDIA_SLOTS>
  avatars?: Record<
    string,
    {
      presentation?: SlotKeys<typeof AVATAR_PRESENTATION_MEDIA_SLOTS>
      mediaTriggers?: SlotKeys<typeof AVATAR_MEDIA_TRIGGER_SLOTS>
    }
  >
}

/** Checks a manifest before any request is sent, so a typo never leaves a half-seeded library. */
export function validateMediaSeedManifest(manifest: MediaSeedManifest): void {
  const seen = new Map<string, MediaSeedAsset>()
  for (const asset of manifest.assets) {
    if (seen.has(asset.key)) throw new Error(`Duplicate media key: ${asset.key}`)
    if (mediaKindForMimeType(asset.mimeType) === null) {
      throw new Error(`Unsupported media type for ${asset.key}: ${asset.mimeType}`)
    }
    if (
      asset.poster !== undefined &&
      seen.get(asset.poster)?.mimeType.startsWith('image/') !== true
    ) {
      throw new Error(`Poster of ${asset.key} must be an image listed before it`)
    }
    seen.set(asset.key, asset)
  }
  const referenced = referencedKeys(manifest)
  for (const key of referenced) {
    if (key === undefined || !seen.has(key)) throw new Error(`Unknown media key: ${String(key)}`)
  }
}

function referencedKeys(manifest: MediaSeedManifest): (string | undefined)[] {
  return [
    ...Object.values(manifest.scenario ?? {}),
    ...Object.values(manifest.avatars ?? {}).flatMap((avatar) => [
      ...Object.values(avatar.presentation ?? {}),
      ...Object.values(avatar.mediaTriggers ?? {}),
    ]),
  ]
}

/** An existing asset with the same description is reused, which makes the seed rerunnable. */
export function findExistingAsset(
  existing: readonly MediaAssetSummary[],
  asset: MediaSeedAsset,
): MediaAssetSummary | undefined {
  return existing.find((item) => item.description === asset.description)
}

/** Replaces manifest keys with asset ids and merges them over the authored presentation. */
export function mergeSlots<
  T extends ScenarioPresentation | AvatarPresentation | AvatarMediaTriggers,
>(
  current: T | undefined,
  slots: Partial<Record<string, string>> | undefined,
  assetIdByKey: ReadonlyMap<string, string>,
): T {
  const resolved = Object.fromEntries(
    Object.entries(slots ?? {}).map(([slot, key]) => [slot, assetIdByKey.get(key ?? '')]),
  )
  return { ...(current ?? ({} as T)), ...resolved }
}
