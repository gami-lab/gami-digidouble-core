import { useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import type { AvailableAvatarSummary, SessionSummary } from '../api'
import type { UnlockEvent } from '../pages/scenario-test-state'

const panelStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '14px',
  backgroundColor: '#f9fafb',
  fontSize: '13px',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginBottom: '6px',
  alignItems: 'flex-start',
}

const labelStyle: CSSProperties = {
  fontWeight: 600,
  color: '#374151',
  flexShrink: 0,
  width: '140px',
}

const valueStyle: CSSProperties = {
  color: '#111827',
  wordBreak: 'break-all',
}

const unlockEventStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #86efac',
  borderRadius: '6px',
  backgroundColor: '#dcfce7',
  marginBottom: '6px',
  fontSize: '12px',
  color: '#15803d',
}

const expandButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  color: '#3b82f6',
  fontSize: '13px',
  textDecoration: 'underline',
}

const rawJsonStyle: CSSProperties = {
  marginTop: '8px',
  padding: '10px',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  backgroundColor: '#f3f4f6',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  fontSize: '11px',
  color: '#374151',
  maxHeight: '200px',
  overflowY: 'auto',
}

type StateInspectorProps = {
  session: SessionSummary | null
  availableAvatars: AvailableAvatarSummary[]
  allAvatarsById: Map<string, AvailableAvatarSummary>
  unlockEvents: UnlockEvent[]
}

export function StateInspector({
  session,
  availableAvatars,
  allAvatarsById,
  unlockEvents,
}: StateInspectorProps): JSX.Element {
  const [showRaw, setShowRaw] = useState(false)

  if (session === null) {
    return (
      <div style={panelStyle}>
        <p style={{ margin: 0, color: '#6b7280' }}>No session active.</p>
      </div>
    )
  }

  const activeAvatar =
    session.activeAvatarId !== undefined
      ? (allAvatarsById.get(session.activeAvatarId)?.name ?? session.activeAvatarId)
      : 'None'

  const unlockedNames = availableAvatars.map((a) => a.name).join(', ') || 'None'

  return (
    <div style={panelStyle}>
      <div style={rowStyle}>
        <span style={labelStyle}>Session ID</span>
        <span style={valueStyle}>{session.sessionId}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Status</span>
        <span style={valueStyle}>{session.status}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Active avatar</span>
        <span style={valueStyle}>{activeAvatar}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Unlocked avatars</span>
        <span style={valueStyle}>{unlockedNames}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Last activity</span>
        <span style={valueStyle}>{new Date(session.lastActivityAt).toLocaleTimeString()}</span>
      </div>

      {unlockEvents.length > 0 ? (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Unlock history</div>
          {unlockEvents.map((event, index) => (
            <div key={index} style={unlockEventStyle}>
              Turn {event.turnIndex} — <strong>{event.avatarName}</strong> unlocked. {event.reason}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: '10px' }}>
        <button
          type="button"
          style={expandButtonStyle}
          onClick={() => {
            setShowRaw((prev) => !prev)
          }}
        >
          {showRaw ? 'Hide raw session JSON' : 'Show raw session JSON'}
        </button>
        {showRaw ? <pre style={rawJsonStyle}>{JSON.stringify(session, null, 2)}</pre> : null}
      </div>
    </div>
  )
}
