import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { getPlayer } from './api/player-session'
import { GuidedExperience } from './flow/GuidedExperience'
import { ErrorScreen, LoadingScreen } from './flow/StoryScreens'

type PlayerState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; userId: string }

function App(): JSX.Element {
  const [player, setPlayer] = useState<PlayerState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getPlayer().then(
      (credential) => {
        if (!cancelled) setPlayer({ status: 'ready', userId: credential.userId })
      },
      () => {
        if (!cancelled) setPlayer({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (player.status === 'ready') return <GuidedExperience userId={player.userId} />
  if (player.status === 'error') {
    return (
      <ErrorScreen
        onRetry={() => {
          setPlayer({ status: 'loading' })
          setAttempt((value) => value + 1)
        }}
      />
    )
  }
  return <LoadingScreen />
}

export default App
