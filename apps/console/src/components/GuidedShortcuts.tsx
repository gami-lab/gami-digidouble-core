import type { CSSProperties, JSX } from 'react'

const containerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const shortcutButtonStyle: CSSProperties = {
  padding: '8px 14px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  backgroundColor: '#f9fafb',
  color: '#374151',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
}

const shortcutButtonDisabledStyle: CSSProperties = {
  ...shortcutButtonStyle,
  color: '#9ca3af',
  borderColor: '#e5e7eb',
  cursor: 'not-allowed',
}

export type GuidedShortcut = {
  id: string
  label: string
  message: string
  disabled?: boolean
  disabledReason?: string
}

export const AI_GUIDED_DISCOVERY_SHORTCUTS: GuidedShortcut[] = [
  {
    id: 'ask_technical',
    label: 'Ask technical question',
    message: 'How do transformer models handle inference latency at scale?',
  },
  {
    id: 'ask_ethics',
    label: 'Ask ethics question',
    message: 'Could AI bias cause dangerous outcomes for society?',
  },
  {
    id: 'return_to_guide',
    label: 'Return to Guide',
    message: '',
  },
  {
    id: 'test_locked',
    label: 'Test locked access',
    message: '',
  },
]

type GuidedShortcutsProps = {
  shortcuts: GuidedShortcut[]
  isSending: boolean
  hasActiveConversation: boolean
  onSendShortcut: (message: string) => void
  onReturnToGuide: () => void
  onTestLockedAccess: () => void
}

export function GuidedShortcuts({
  shortcuts,
  isSending,
  hasActiveConversation,
  onSendShortcut,
  onReturnToGuide,
  onTestLockedAccess,
}: GuidedShortcutsProps): JSX.Element {
  return (
    <div style={containerStyle}>
      {shortcuts.map((shortcut) => {
        const isDisabled = isSending || shortcut.disabled === true || !hasActiveConversation
        const title = shortcut.disabled === true ? shortcut.disabledReason : undefined

        return (
          <button
            key={shortcut.id}
            type="button"
            style={isDisabled ? shortcutButtonDisabledStyle : shortcutButtonStyle}
            disabled={isDisabled}
            title={title}
            onClick={() => {
              if (shortcut.id === 'return_to_guide') {
                onReturnToGuide()
              } else if (shortcut.id === 'test_locked') {
                onTestLockedAccess()
              } else {
                onSendShortcut(shortcut.message)
              }
            }}
          >
            {shortcut.label}
          </button>
        )
      })}
    </div>
  )
}
