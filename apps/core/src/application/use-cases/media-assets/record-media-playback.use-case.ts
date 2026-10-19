import type { MediaPlaybackOutcome } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import { mediaCueEventId } from '../../services/media/media-cue.service.js'

export type RecordMediaPlaybackInput = {
  sessionId: string
  cueId: string
  outcome: MediaPlaybackOutcome
  clientLatencyMs?: number
}

/**
 * Records how the player handled a cue. The cue must have been emitted to this session; the
 * server measures cue-to-report time from its own `media.cue_emitted` entry. Each outcome is
 * recorded once per cue, so a retried report is harmless.
 */
export class RecordMediaPlaybackUseCase {
  constructor(private readonly eventLogRepository: IEventLogRepository) {}

  async execute(input: RecordMediaPlaybackInput): Promise<{ recorded: boolean }> {
    const cue = await this.eventLogRepository.findById(mediaCueEventId(input.cueId))
    if (cue === null || cue.sessionId !== input.sessionId) {
      throw new DomainError('NOT_FOUND', 'Media cue not found')
    }
    const emittedAt = Date.parse(cue.createdAt ?? '')
    const recorded = await this.eventLogRepository.appendOnce(
      `evt_media_playback_${input.cueId}_${input.outcome}`,
      {
        sessionId: input.sessionId,
        type: `media.playback_${input.outcome}`,
        severity: input.outcome === 'failed' ? 'warning' : 'info',
        ...(cue.correlationId !== undefined ? { correlationId: cue.correlationId } : {}),
        payload: {
          cueId: input.cueId,
          assetId: cue.payload['assetId'],
          origin: cue.payload['origin'],
          ...(Number.isFinite(emittedAt) ? { cueToReportMs: Date.now() - emittedAt } : {}),
          ...(input.clientLatencyMs !== undefined
            ? { clientLatencyMs: input.clientLatencyMs }
            : {}),
        },
      },
    )
    return { recorded }
  }
}
