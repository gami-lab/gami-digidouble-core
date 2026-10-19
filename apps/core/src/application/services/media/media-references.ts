import type { MediaKind, MediaRef } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import {
  presentationMediaReferences,
  readPresentation,
} from '../../../domain/presentation/presentation.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import {
  mediaTriggerReferences,
  readMediaTriggers,
} from '../../../domain/media/avatar-media-triggers.js'
import type { MediaAsset } from '../../../domain/media/media-asset.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'

export type MediaReference = {
  slot: string
  assetId: MediaRef
  allowedKinds: readonly MediaKind[]
}

/**
 * Rejects references to assets that are missing, belong to another scenario, or have a kind the
 * slot does not accept. Called before a scenario or avatar that references media is saved.
 */
export async function assertMediaReferences(
  repository: IMediaAssetRepository,
  scenarioId: string,
  references: readonly MediaReference[],
): Promise<void> {
  if (references.length === 0) return
  const assets = await repository.findByIds(
    scenarioId,
    references.map((reference) => reference.assetId),
  )
  const kindById = new Map(assets.map((asset) => [asset.assetId, asset.kind]))
  for (const { slot, assetId, allowedKinds } of references) {
    const kind = kindById.get(assetId)
    if (kind === undefined) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `${slot} references media asset ${assetId}, which does not exist in this scenario.`,
      )
    }
    if (!allowedKinds.includes(kind)) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `${slot} accepts ${allowedKinds.join(' or ')} media, but ${assetId} is ${kind}.`,
      )
    }
  }
}

/** Every media reference a scenario or avatar config holds: presentation slots and triggers. */
export function configMediaReferences(
  kind: 'scenario' | 'avatar',
  config: object,
): MediaReference[] {
  const presentation = presentationMediaReferences(kind, readPresentation(kind, config))
  return kind === 'avatar'
    ? [...presentation, ...mediaTriggerReferences(readMediaTriggers(config))]
    : presentation
}

/** Validates the media references of a scenario or avatar config about to be persisted. */
export async function assertConfigMedia(
  repository: IMediaAssetRepository,
  kind: 'scenario' | 'avatar',
  scenarioId: string,
  config: object,
): Promise<void> {
  await assertMediaReferences(repository, scenarioId, configMediaReferences(kind, config))
}

/**
 * Where an asset is used within its scenario: presentation slots and triggers of the scenario and
 * its avatars, and posters of other assets. Each entry is a short operator-facing label.
 */
export function findMediaUsages(
  assetId: MediaRef,
  scenario: Scenario,
  avatars: readonly AvatarConfig[],
  assets: readonly MediaAsset[],
): string[] {
  const usedBy = (kind: 'scenario' | 'avatar', config: object, owner: string): string[] =>
    configMediaReferences(kind, config)
      .filter((reference) => reference.assetId === assetId)
      .map((reference) => `${owner} ${reference.slot}`)
  return [
    ...usedBy('scenario', scenario.config, 'scenario'),
    ...avatars.flatMap((avatar) => usedBy('avatar', avatar.config, avatar.name)),
    ...assets
      .filter((asset) => asset.posterAssetId === assetId)
      .map((asset) => `poster of ${asset.assetId}`),
  ]
}
