import type { JSX } from 'react'
import type { AvatarSummary, ScenarioSummary, SessionSummary } from '../api'
import { useSessionPageController } from './session-controller'
import { SessionDetailSection, StartSessionSection } from './session-components'

type SessionPageProps = {
  scenario: ScenarioSummary
  initialAvatar: AvatarSummary | null
  sessionId: string | null
  knownSessions?: SessionSummary[]
  onSessionIdChange: (sessionId: string | null) => void
  onSessionStarted?: (session: SessionSummary) => void
}

export function SessionPage({
  scenario,
  initialAvatar,
  sessionId,
  knownSessions = [],
  onSessionIdChange,
  onSessionStarted,
}: SessionPageProps): JSX.Element {
  const controller = useSessionPageController(
    scenario,
    initialAvatar,
    sessionId,
    onSessionIdChange,
    onSessionStarted,
  )

  if (controller.activeSessionId === null) {
    return (
      <StartSessionSection
        scenario={scenario}
        userId={controller.userId}
        isStartingSession={controller.isStartingSession}
        error={controller.submitError}
        knownSessions={knownSessions}
        onUserIdChange={controller.setUserId}
        onSubmit={controller.handleStartSessionSubmit}
        onSelectSession={onSessionIdChange}
      />
    )
  }

  return (
    <SessionDetailSection
      scenario={scenario}
      controller={controller}
      avatarsById={controller.avatarsById}
    />
  )
}
