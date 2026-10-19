import type { JSX } from 'react'
import { formatMs, formatTime } from '../../debug/format'
import type { MediaEvent } from '../../debug/session-timeline'
import { Badge, Section } from '../../ui/ui'

/** Media cues and the player's playback reports, with the measured cue-to-playback times. */
export function MediaEventsView({ events }: { events: MediaEvent[] }): JSX.Element | null {
  if (events.length === 0) return null
  return (
    <Section defaultOpen title="Media" aside={<span className="small muted">{events.length} events</span>}>
      <ul className="stack small">
        {events.map((event) => (
          <li key={`${event.type}:${event.createdAt}:${event.payload.cueId ?? event.payload.assetId}`}>
            <Badge tone={mediaTone(event)}>{event.type.replace('media.', '')}</Badge>{' '}
            <span className="mono">{event.payload.assetId}</span>
            {event.payload.origin !== undefined ? ` · ${event.payload.origin}` : ''}
            {event.payload.display !== undefined ? ` · ${event.payload.display}` : ''}
            {event.payload.reason !== undefined ? ` · ${event.payload.reason}` : ''}
            {event.payload.cueToReportMs !== undefined
              ? ` · ${formatMs(event.payload.cueToReportMs)} after the cue`
              : ''}
            {event.payload.clientLatencyMs !== undefined
              ? ` (player ${formatMs(event.payload.clientLatencyMs)})`
              : ''}{' '}
            <span className="muted">{formatTime(event.createdAt)}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function mediaTone(event: MediaEvent): 'ok' | 'warn' | 'error' | 'neutral' {
  if (event.type === 'media.playback_failed') return 'error'
  if (event.type === 'media.cue_skipped' || event.type === 'media.playback_skipped') return 'warn'
  if (event.type === 'media.playback_completed') return 'ok'
  return 'neutral'
}
