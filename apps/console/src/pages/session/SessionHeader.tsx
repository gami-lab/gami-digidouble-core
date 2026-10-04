import { useState } from 'react'
import type { JSX } from 'react'
import { formatApiError } from '../../api/error'
import {
  clearSessionMemory,
  refreshSessionMemory,
  replayGm,
  resetSession,
} from '../../api/sessions'
import { shortId } from '../../debug/format'
import { Badge, ErrorText, KeyValues, LangfuseSessionLink, Section } from '../../ui/ui'
import type { SessionData, SessionDataState } from './use-session-data'

export function avatarName(data: SessionData, avatarId: string | null | undefined): string {
  if (avatarId === null || avatarId === undefined) return '—'
  return data.avatars.find((avatar) => avatar.avatarId === avatarId)?.name ?? shortId(avatarId)
}

// eslint-disable-next-line complexity -- render-only branching
export function SessionHeader({
  data,
  state,
}: {
  data: SessionData
  state: SessionDataState
}): JSX.Element {
  const { session, gmState, effectiveModels, gmNotes } = data.inspect
  const unlocked = data.inspect.unlockedAvatarIds.map((id) => avatarName(data, id))

  return (
    <div className="card stack">
      <div className="row spread">
        <div className="row">
          <h1>{session.userId}</h1>
          <Badge tone={session.status === 'active' ? 'ok' : 'neutral'}>{session.status}</Badge>
          <span
            className="row small muted"
            title={state.isLive ? 'Following live updates' : 'Live updates unavailable'}
          >
            <span className={state.isLive ? 'live-dot' : 'live-dot off'} />
            {state.isLive ? 'live' : 'offline'}
          </span>
          {state.isProcessing ? <Badge tone="accent">processing…</Badge> : null}
        </div>
        <div className="row">
          <LangfuseSessionLink sessionId={session.sessionId} />
          <button type="button" onClick={state.reload} disabled={state.isLoading}>
            {state.isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      <KeyValues
        items={[
          ['Talking to', avatarName(data, session.activeAvatarId)],
          [
            'Game Master',
            gmState === null
              ? 'not started'
              : `progression “${gmState.progression || '—'}” · ${String(gmState.interactionCount)} interactions`,
          ],
          ['Unlocked avatars', unlocked.length > 0 ? unlocked.join(', ') : '—'],
          [
            'Queued director note',
            gmNotes ?? <span className="muted">none (applies to the next turn)</span>,
          ],
          [
            'Models',
            `Avatar ${effectiveModels.avatar.provider}/${effectiveModels.avatar.model} · GM ${effectiveModels.gameMaster.provider}/${effectiveModels.gameMaster.model} · Memory ${effectiveModels.memory.provider}/${effectiveModels.memory.model}`,
          ],
        ]}
      />
      <OperatorActions sessionId={session.sessionId} onDone={state.reload} />
    </div>
  )
}

const actions = [
  {
    label: 'Replay GM on last turn',
    run: replayGm,
    confirm: null,
  },
  {
    label: 'Refresh working memory',
    run: refreshSessionMemory,
    confirm: null,
  },
  {
    label: 'Clear working memory',
    run: clearSessionMemory,
    confirm: 'Clear session and avatar working memory and GM notes? User facts are kept.',
  },
  {
    label: 'Reset session',
    run: resetSession,
    confirm: 'Reset the session? All conversations and messages are deleted.',
  },
] as const

function OperatorActions({
  sessionId,
  onDone,
}: {
  sessionId: string
  onDone: () => void
}): JSX.Element {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run(action: (typeof actions)[number]): void {
    if (action.confirm !== null && !window.confirm(action.confirm)) return
    setError(null)
    setStatus(`${action.label}…`)
    action
      .run(sessionId)
      .then(() => {
        setStatus(
          `${action.label}: done. Results appear in the timeline when the background work finishes.`,
        )
        onDone()
      })
      .catch((actionError: unknown) => {
        setStatus(null)
        setError(formatApiError(actionError, `${action.label} failed`))
      })
  }

  return (
    <Section
      nested
      title="Operator actions"
      aside={<span className="muted small">replay, refresh, reset</span>}
    >
      <div className="row">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={action.confirm !== null ? 'danger' : undefined}
            onClick={() => {
              run(action)
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      {status !== null ? <p className="small muted">{status}</p> : null}
      <ErrorText error={error} />
    </Section>
  )
}
