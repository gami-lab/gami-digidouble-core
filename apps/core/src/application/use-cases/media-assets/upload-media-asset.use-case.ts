import { randomUUID } from 'node:crypto'
import {
  MEDIA_LIMITS,
  mediaKindForMimeType,
  type MediaAssetSummary,
  type MediaMimeType,
  type MediaRef,
} from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import {
  MEDIA_SIGNATURE_BYTES,
  matchesMediaSignature,
} from '../../../domain/media/media-signature.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { IMediaStorage } from '../../ports/IMediaStorage.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { toMediaAssetSummary } from '../../services/media/media-asset-projection.js'
import {
  assertDurationMs,
  assertPoster,
  normalizeDescription,
  requireScenario,
} from './media-asset-input.js'

export type UploadMediaAssetInput = {
  scenarioId: string
  contentType: string
  /** The request `Content-Length`, when the client sent one. */
  declaredByteSize?: number
  content: AsyncIterable<Uint8Array>
  description: string
  cueable: boolean
  posterAssetId?: MediaRef
  durationMs?: number
}

export class UploadMediaAssetUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
    private readonly mediaStorage: IMediaStorage,
  ) {}

  async execute(input: UploadMediaAssetInput): Promise<MediaAssetSummary> {
    await requireScenario(this.scenarioRepository, input.scenarioId)
    const mimeType = input.contentType.split(';')[0]?.trim().toLowerCase() ?? ''
    const kind = mediaKindForMimeType(mimeType)
    if (kind === null) throw new DomainError('VALIDATION_ERROR', 'Unsupported media type.')
    const maxBytes = MEDIA_LIMITS.maxUploadBytes[kind]
    if (input.declaredByteSize !== undefined && input.declaredByteSize > maxBytes) {
      throw tooLarge(maxBytes)
    }
    const description = normalizeDescription(input.description)
    assertDurationMs(input.durationMs)
    await assertPoster(this.mediaAssetRepository, input.scenarioId, input.posterAssetId)

    const storageKey = randomUUID()
    const { byteSize } = await this.mediaStorage.put(
      storageKey,
      inspectUpload(input.content, mimeType as MediaMimeType, maxBytes),
    )
    try {
      const asset = await this.mediaAssetRepository.create({
        assetId: `media_${storageKey}`,
        scenarioId: input.scenarioId,
        kind,
        source: 'upload',
        storageKey,
        url: null,
        mimeType,
        byteSize,
        posterAssetId: input.posterAssetId ?? null,
        durationMs: input.durationMs ?? null,
        description,
        cueable: input.cueable,
      })
      return toMediaAssetSummary(asset)
    } catch (error) {
      await this.mediaStorage.delete(storageKey)
      throw error
    }
  }
}

/** Passes the upload through while checking its signature and size, without buffering it. */
async function* inspectUpload(
  content: AsyncIterable<Uint8Array>,
  mimeType: MediaMimeType,
  maxBytes: number,
): AsyncGenerator<Uint8Array> {
  let head: Uint8Array = new Uint8Array(0)
  let total = 0
  for await (const chunk of content) {
    total += chunk.byteLength
    if (total > maxBytes) throw tooLarge(maxBytes)
    if (head.byteLength < MEDIA_SIGNATURE_BYTES) {
      head = concat(head, chunk)
      if (head.byteLength < MEDIA_SIGNATURE_BYTES) continue
      assertSignature(mimeType, head)
      yield head
      continue
    }
    yield chunk
  }
  if (head.byteLength < MEDIA_SIGNATURE_BYTES) {
    assertSignature(mimeType, head)
    if (head.byteLength > 0) yield head
  }
}

function assertSignature(mimeType: MediaMimeType, head: Uint8Array): void {
  if (!matchesMediaSignature(mimeType, head)) {
    throw new DomainError('VALIDATION_ERROR', 'File content does not match its media type.')
  }
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const result = new Uint8Array(left.byteLength + right.byteLength)
  result.set(left, 0)
  result.set(right, left.byteLength)
  return result
}

function tooLarge(maxBytes: number): DomainError {
  return new DomainError(
    'VALIDATION_ERROR',
    `File exceeds the ${String(maxBytes)} byte limit for this media type.`,
  )
}
