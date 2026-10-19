import type {
  AvatarPresentation,
  MediaRef,
  PublicAvatarPresentation,
  PublicMediaAsset,
  PublicScenarioPresentation,
  ScenarioPresentation,
} from '@gami/shared'
import { presentationMediaReferences } from '../../../domain/presentation/presentation.js'

/** Resolves asset ids of one scenario to their player projection; unknown ids are absent. */
export type PublicMediaLookup = (
  scenarioId: string,
  assetIds: readonly MediaRef[],
) => Promise<ReadonlyMap<MediaRef, PublicMediaAsset>>

export async function toPublicScenarioPresentation(
  scenarioId: string,
  presentation: ScenarioPresentation,
  lookup: PublicMediaLookup,
): Promise<PublicScenarioPresentation> {
  return await resolve('scenario', scenarioId, presentation, lookup)
}

export async function toPublicAvatarPresentation(
  scenarioId: string,
  presentation: AvatarPresentation,
  lookup: PublicMediaLookup,
): Promise<PublicAvatarPresentation> {
  return await resolve('avatar', scenarioId, presentation, lookup)
}

async function resolve(
  kind: 'scenario' | 'avatar',
  scenarioId: string,
  presentation: ScenarioPresentation | AvatarPresentation,
  lookup: PublicMediaLookup,
): Promise<Record<string, unknown>> {
  const references = presentationMediaReferences(kind, presentation)
  const assets =
    references.length === 0
      ? new Map<MediaRef, PublicMediaAsset>()
      : await lookup(
          scenarioId,
          references.map((reference) => reference.assetId),
        )
  const result: Record<string, unknown> = { ...presentation }
  for (const { slot, assetId, allowedKinds } of references) {
    const asset = assets.get(assetId)
    if (asset !== undefined && allowedKinds.includes(asset.kind)) result[slot] = asset
    else Reflect.deleteProperty(result, slot)
  }
  return result
}
