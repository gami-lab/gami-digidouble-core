import type { CSSProperties, JSX } from 'react'
import type { AvatarAvailabilityEntry } from '../pages/scenario-test-state'

const panelStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '14px',
  backgroundColor: '#f9fafb',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px',
  borderRadius: '8px',
  marginBottom: '8px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
}

const badgeBase: CSSProperties = {
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
}

const badges = {
  active: {
    ...badgeBase,
    backgroundColor: '#dcfce7',
    color: '#15803d',
    border: '1px solid #86efac',
  },
  available: {
    ...badgeBase,
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    border: '1px solid #93c5fd',
  },
  locked: {
    ...badgeBase,
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    border: '1px solid #d1d5db',
  },
} satisfies Record<string, CSSProperties>

const switchButtonStyle: CSSProperties = {
  marginLeft: 'auto',
  padding: '6px 12px',
  border: '1px solid #1f2937',
  borderRadius: '6px',
  backgroundColor: '#1f2937',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '13px',
}

const disabledSwitchButtonStyle: CSSProperties = {
  ...switchButtonStyle,
  backgroundColor: '#d1d5db',
  borderColor: '#d1d5db',
  color: '#9ca3af',
  cursor: 'not-allowed',
}

const badgeLabels: Record<string, string> = {
  active: 'Active',
  available: 'Available',
  locked: 'Locked',
}

type AvatarAvailabilityPanelProps = {
  entries: AvatarAvailabilityEntry[]
  isSwitching: boolean
  onSwitch: (avatarId: string) => void
}

export function AvatarAvailabilityPanel({
  entries,
  isSwitching,
  onSwitch,
}: AvatarAvailabilityPanelProps): JSX.Element {
  return (
    <div style={panelStyle}>
      {entries.length === 0 ? (
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Start a session to see avatars.
        </p>
      ) : null}
      {entries.map(({ avatar, status }) => {
        const isLocked = status === 'locked'
        const isActive = status === 'active'
        const canSwitch = !isLocked && !isActive && !isSwitching

        return (
          <div key={avatar.avatarId} style={rowStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{avatar.name}</div>
              {avatar.description !== undefined && avatar.description.length > 0 ? (
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  {avatar.description}
                </div>
              ) : null}
              {isLocked ? (
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                  Not yet unlocked — chat with the guide first.
                </div>
              ) : null}
            </div>
            <span style={badges[status]}>{badgeLabels[status]}</span>
            {isActive ? null : (
              <button
                type="button"
                style={canSwitch ? switchButtonStyle : disabledSwitchButtonStyle}
                disabled={!canSwitch}
                title={
                  isLocked ? 'This specialist is locked. Chat with the guide first.' : undefined
                }
                onClick={() => {
                  if (canSwitch) onSwitch(avatar.avatarId)
                }}
              >
                {isSwitching ? 'Switching…' : 'Talk to ' + avatar.name}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
