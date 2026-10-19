import type { MediaAsset } from '../domain/media/media-asset.types.js'

/** Smallest byte sequences that pass the upload signature check for each type. */
export const PNG_BYTES = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)
export const MP4_BYTES = Uint8Array.from([
  0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0,
])

export function makeMediaAsset(
  overrides: Partial<MediaAsset> & Pick<MediaAsset, 'assetId'>,
): MediaAsset {
  return {
    scenarioId: 'scenario_1',
    kind: 'image',
    source: 'upload',
    storageKey: overrides.assetId.replace(/^media_/, ''),
    url: null,
    mimeType: 'image/png',
    byteSize: PNG_BYTES.byteLength,
    posterAssetId: null,
    durationMs: null,
    description: 'An image',
    cueable: false,
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:00:00.000Z',
    ...overrides,
  }
}
