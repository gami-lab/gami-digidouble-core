import type {
  MediaPlaybackOutcome,
  ReportMediaPlaybackRequest,
  ReportMediaPlaybackResponse,
} from '@gami/shared'
import { webRequest } from './client'

/** Best-effort: a failed report never affects playback. */
export async function reportMediaPlayback(
  sessionId: string,
  cueId: string,
  outcome: MediaPlaybackOutcome,
  clientLatencyMs?: number,
): Promise<void> {
  const body: ReportMediaPlaybackRequest = {
    outcome,
    ...(clientLatencyMs !== undefined
      ? { clientLatencyMs: Math.max(0, Math.round(clientLatencyMs)) }
      : {}),
  }
  try {
    await webRequest<ReportMediaPlaybackResponse>(
      'POST',
      `/v1/sessions/${sessionId}/media-cues/${cueId}/playback`,
      body,
    )
  } catch {
    return
  }
}
