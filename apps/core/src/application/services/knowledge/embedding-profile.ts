import type { EmbeddingProfile } from '../../ports/IEmbeddingAdapter.js'

export function areEmbeddingProfilesEqual(
  left: EmbeddingProfile,
  right: EmbeddingProfile,
): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.dimensions === right.dimensions
  )
}
