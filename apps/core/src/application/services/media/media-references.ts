import type { MediaKind, MediaRef } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import {
  presentationMediaReferences,
  readPresentation,
} from '../../../domain/presentation/presentation.js'
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

/** Validates the media slots of the presentation stored in a scenario or avatar config. */
export async function assertPresentationMedia(
  repository: IMediaAssetRepository,
  kind: 'scenario' | 'avatar',
  scenarioId: string,
  config: object,
): Promise<void> {
  const presentation = readPresentation(kind, config)
  await assertMediaReferences(
    repository,
    scenarioId,
    presentationMediaReferences(kind, presentation),
  )
}
