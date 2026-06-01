import type { JSX } from 'react'
import type { AvailableAvatarSummary, SessionSummary } from '@gami/shared'

type AvatarLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

type AvatarDiscoverySectionProps = {
  selectedScenarioId: string | null
  avatarStatus: AvatarLoadStatus
  avatarError: string | null
  avatars: AvailableAvatarSummary[]
  session: SessionSummary | null
  lastAvatarSyncAt: string | null
}

export function AvatarDiscoverySection(props: AvatarDiscoverySectionProps): JSX.Element {
  const { selectedScenarioId, avatars } = props

  return (
    <section className="discovery-section" aria-labelledby="avatars-title">
      <h2 id="avatars-title">Available avatars</h2>
      <AvatarStatusMessage {...props} />
      {selectedScenarioId !== null && avatars.length > 0 ? <AvatarList avatars={avatars} /> : null}
      <AvatarSyncMessage
        selectedScenarioId={selectedScenarioId}
        session={props.session}
        lastAvatarSyncAt={props.lastAvatarSyncAt}
      />
    </section>
  )
}

function AvatarStatusMessage({
  selectedScenarioId,
  avatarStatus,
  avatarError,
  avatars,
}: AvatarDiscoverySectionProps): JSX.Element | null {
  if (selectedScenarioId === null) {
    return <p className="muted">Select a scenario to load avatar availability.</p>
  }

  if (avatarStatus === 'loading') {
    return <p className="muted">Loading available avatars…</p>
  }

  if (avatarError !== null) {
    return <p className="error">{avatarError}</p>
  }

  if (avatarStatus === 'ready' && avatars.length === 0) {
    return <p className="muted">No avatars are currently available. Keep this page open for unlocks.</p>
  }

  return null
}

function AvatarList({ avatars }: { avatars: AvailableAvatarSummary[] }): JSX.Element {
  return (
    <ul className="avatar-list" aria-label="Available avatars">
      {avatars.map((avatar) => (
        <li key={avatar.avatarId} className="avatar-card">
          <p className="avatar-name">{avatar.name}</p>
          <p className="avatar-description">{avatar.description ?? 'No description yet.'}</p>
        </li>
      ))}
    </ul>
  )
}

type AvatarSyncMessageProps = {
  selectedScenarioId: string | null
  session: SessionSummary | null
  lastAvatarSyncAt: string | null
}

function AvatarSyncMessage({
  selectedScenarioId,
  session,
  lastAvatarSyncAt,
}: AvatarSyncMessageProps): JSX.Element | null {
  if (selectedScenarioId === null || session === null || lastAvatarSyncAt === null) {
    return null
  }

  return (
    <p className="muted">
      Session {session.sessionId} · Availability refreshed at{' '}
      {new Date(lastAvatarSyncAt).toLocaleTimeString()} (every 5s)
    </p>
  )
}
