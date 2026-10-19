import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'

/** Written by a session reset; media seen before it no longer counts for the session. */
export const SESSION_RESET_EVENT_TYPE = 'session_reset'

export type SessionMediaHistory = {
  /** Identifies the session's current run: the time of the last reset, or `start`. */
  runKey: string
  /** Assets cued (by any trigger) in the current run. */
  cuedAssetIds: ReadonlySet<unknown>
}

/**
 * Media history of the session's current run. Cues are keyed per run so that a reset replays
 * unlock media and returns cued assets to the Game Master catalogue.
 */
export async function loadSessionMediaHistory(
  eventLogRepository: IEventLogRepository | undefined,
  sessionId: string,
): Promise<SessionMediaHistory> {
  if (eventLogRepository === undefined) return { runKey: 'start', cuedAssetIds: new Set() }
  const [lastReset] = await eventLogRepository.findBySessionId(sessionId, {
    type: SESSION_RESET_EVENT_TYPE,
    limit: 1,
  })
  const since = lastReset?.createdAt
  const cues = await eventLogRepository.findBySessionId(sessionId, { type: 'media.cue_emitted' })
  return {
    runKey: since ?? 'start',
    cuedAssetIds: new Set(
      cues
        .filter((cue) => since === undefined || (cue.createdAt ?? '') > since)
        .map((cue) => cue.payload['assetId']),
    ),
  }
}
