import type { JSX } from 'react'
import type { AvatarSummary, ScenarioSummary } from '../api'
import { useSessionPageController } from './session-controller'
import { SessionDetailSection, StartSessionSection } from './session-components'

type SessionPageProps = {
  scenario: ScenarioSummary
  initialAvatar: AvatarSummary | null
  sessionId: string | null
  onSessionIdChange: (sessionId: string | null) => void
}

export function SessionPage({ scenario, initialAvatar, sessionId, onSessionIdChange }: SessionPageProps): JSX.Element {
  const controller = useSessionPageController(scenario, initialAvatar, sessionId, onSessionIdChange)

  if (controller.activeSessionId === null) {
    return (
      <StartSessionSection
        scenario={scenario}
        userId={controller.userId}
        isStartingSession={controller.isStartingSession}
        error={controller.submitError}
        onUserIdChange={controller.setUserId}
        onSubmit={controller.handleStartSessionSubmit}
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
