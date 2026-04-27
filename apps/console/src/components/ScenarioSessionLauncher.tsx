import type { CSSProperties, Dispatch, JSX, SetStateAction } from 'react'
import type { SessionSummary } from '../api'
import { buttonStyle, inputStyle } from '../pages/form-styles'

type ScenarioSessionLauncherProps = {
  userId: string
  session: SessionSummary | null
  isStarting: boolean
  onUserIdChange: Dispatch<SetStateAction<string>>
  onStart: () => void
}

const activeSessionStyle: CSSProperties = {
  padding: '10px 14px',
  border: '1px solid #86efac',
  borderRadius: '8px',
  backgroundColor: '#dcfce7',
  fontSize: '13px',
  color: '#15803d',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

export function ScenarioSessionLauncher({
  userId,
  session,
  isStarting,
  onUserIdChange,
  onStart,
}: ScenarioSessionLauncherProps): JSX.Element {
  if (session !== null) {
    return (
      <div style={activeSessionStyle}>
        <span>
          Session active - <strong>{session.sessionId}</strong>
        </span>
        <button type="button" style={{ ...buttonStyle, marginTop: 0 }} onClick={onStart}>
          Reset &amp; new session
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
      <div style={{ flex: 1 }}>
        <label
          htmlFor="scenario-test-user-id"
          style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '13px' }}
        >
          User ID
        </label>
        <input
          id="scenario-test-user-id"
          type="text"
          value={userId}
          style={{ ...inputStyle, marginTop: 0 }}
          onChange={(event) => {
            onUserIdChange(event.target.value)
          }}
          disabled={isStarting}
        />
      </div>
      <button
        type="button"
        style={{ ...buttonStyle, marginTop: 0, whiteSpace: 'nowrap' }}
        disabled={isStarting || userId.trim() === ''}
        onClick={onStart}
      >
        {isStarting ? 'Starting...' : 'Start session'}
      </button>
    </div>
  )
}
