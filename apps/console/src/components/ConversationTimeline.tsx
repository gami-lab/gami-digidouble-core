import type { CSSProperties, JSX } from 'react'
import type { ConversationSummary } from '../api'

type TimelineEntry = {
  conversation: ConversationSummary
  avatarName: string
  episodeIndex: number
}

const containerStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '14px',
  backgroundColor: '#f9fafb',
}

const entryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px',
  borderRadius: '8px',
  marginBottom: '8px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
}

const entrySelectedStyle: CSSProperties = {
  ...entryStyle,
  border: '1px solid #3b82f6',
  backgroundColor: '#eff6ff',
}

const indexBadgeStyle: CSSProperties = {
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  backgroundColor: '#e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 700,
  color: '#374151',
  flexShrink: 0,
}

const statusDotStyle: Record<string, CSSProperties> = {
  active: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
  },
  closed: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#9ca3af',
  },
  archived: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b',
  },
}

type ConversationTimelineProps = {
  entries: TimelineEntry[]
  selectedConversationId: string | null
  isLoading: boolean
  onSelectConversation: (conversation: ConversationSummary) => void
}

export function ConversationTimeline({
  entries,
  selectedConversationId,
  isLoading,
  onSelectConversation,
}: ConversationTimelineProps): JSX.Element {
  return (
    <div style={containerStyle}>
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          No conversations yet. Start talking to an avatar.
        </p>
      ) : null}
      {entries.map(({ conversation, avatarName, episodeIndex }) => {
        const isSelected = conversation.conversationId === selectedConversationId
        const dotStyle = statusDotStyle[conversation.status] ?? statusDotStyle.closed

        return (
          <div
            key={conversation.conversationId}
            style={isSelected ? entrySelectedStyle : entryStyle}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => {
              onSelectConversation(conversation)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                onSelectConversation(conversation)
              }
            }}
          >
            <div style={indexBadgeStyle}>{episodeIndex}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                {avatarName} #{episodeIndex}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                Started: {new Date(conversation.startedAt).toLocaleTimeString()}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={dotStyle} />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{conversation.status}</span>
            </div>
            {isLoading && isSelected ? (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Loading…</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
