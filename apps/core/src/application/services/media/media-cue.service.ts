import { createHash, randomUUID } from 'node:crypto'
import type { MediaCueOrigin, MediaCuePayload, MediaRef } from '@gami/shared'
import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import { findPublicMediaAssets } from './media-asset-projection.js'

export type MediaCueRequest = {
  sessionId: string
  scenarioId: string
  conversationId?: string
  correlationId?: string
  assetId: MediaRef
  origin: MediaCueOrigin
  /**
   * Identifies the triggering event (an unlock, a switch, a GM run). The cue id derives from it
   * and the asset, so retries and replays of the same event never emit twice.
   */
  triggerKey: string
}

export function deriveMediaCueId(triggerKey: string, assetId: MediaRef): string {
  return `cue_${createHash('sha256').update(`${triggerKey}|${assetId}`).digest('hex').slice(0, 32)}`
}

/**
 * Resolves a media trigger to its asset, records `media.cue_emitted`, then publishes
 * `runtime.media_cue` on the session stream. It never throws: media must not affect the
 * operation that triggered it, so a missing asset or a failure only leaves a bounded diagnostic.
 */
export class MediaCueService {
  constructor(
    private readonly mediaAssetRepository: IMediaAssetRepository,
    private readonly eventLogRepository: IEventLogRepository | undefined,
    private readonly sessionEventPublisher: ISessionEventPublisher | undefined,
  ) {}

  async emit(request: MediaCueRequest): Promise<void> {
    try {
      await this.emitOrSkip(request)
    } catch (error: unknown) {
      console.warn('[media] Cue emission failed:', {
        origin: request.origin,
        assetId: request.assetId,
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  private async recordSkip(request: MediaCueRequest): Promise<void> {
    await this.eventLogRepository?.append(
      withRequestContext(request, 'media.cue_skipped', 'warning', {
        origin: request.origin,
        assetId: request.assetId,
        reason: 'asset_not_found',
      }),
    )
  }

  private async emitOrSkip(request: MediaCueRequest): Promise<void> {
    const assets = await findPublicMediaAssets(this.mediaAssetRepository, request.scenarioId, [
      request.assetId,
    ])
    const asset = assets.get(request.assetId)
    if (asset === undefined) {
      await this.recordSkip(request)
      return
    }

    const payload: MediaCuePayload = {
      cueId: deriveMediaCueId(request.triggerKey, request.assetId),
      asset,
      origin: request.origin,
      display: asset.kind === 'video' ? 'fullscreen' : 'overlay',
    }
    const recorded =
      this.eventLogRepository === undefined ||
      (await this.eventLogRepository.appendOnce(
        mediaCueEventId(payload.cueId),
        withRequestContext(request, 'media.cue_emitted', 'info', {
          cueId: payload.cueId,
          origin: payload.origin,
          assetId: asset.assetId,
          kind: asset.kind,
          display: payload.display,
        }),
      ))
    if (!recorded) return

    this.sessionEventPublisher?.emit({
      eventId: `rev_${randomUUID()}`,
      sessionId: request.sessionId,
      ...(request.conversationId !== undefined ? { conversationId: request.conversationId } : {}),
      ...(request.correlationId !== undefined ? { correlationId: request.correlationId } : {}),
      type: 'runtime.media_cue',
      occurredAt: new Date().toISOString(),
      payload,
    })
  }
}

function withRequestContext(
  request: MediaCueRequest,
  type: string,
  severity: StoredEvent['severity'],
  payload: Record<string, unknown>,
): StoredEvent {
  return {
    sessionId: request.sessionId,
    type,
    severity,
    ...(request.correlationId !== undefined ? { correlationId: request.correlationId } : {}),
    payload,
  }
}

/** The `event_log` id of a cue's `media.cue_emitted` entry. */
export function mediaCueEventId(cueId: string): string {
  return `evt_media_cue_${cueId}`
}
