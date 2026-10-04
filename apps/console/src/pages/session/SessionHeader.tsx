import { useState } from 'react'
import type { JSX } from 'react'
import { formatApiError } from '../../api/error'
import {
  clearSessionMemory,
  refreshSessionMemory,
  replayGm,
  resetSession,
} from '../../api/sessions'
import { formatTime, shortId } from '../../debug/format'
import { Badge, ErrorText, KeyValues, LangfuseSessionLink, Section, TextList } from '../../ui/ui'
import type { SessionData, SessionDataState } from './use-session-data'

export function avatarName(data: SessionData, avatarId: string | null | undefined): string {
  if (avatarId === null || avatarId === undefined) return '—'
  return data.avatars.find((avatar) => avatar.avatarId === avatarId)?.name ?? shortId(avatarId)
}

export function SessionHeader({
  data,
  state,
}: {
  data: SessionData
  state: SessionDataState
}): JSX.Element {
  const { session, effectiveModels } = data.inspect
  const unlocked = data.inspect.unlockedAvatarIds.map((id) => avatarName(data, id))
  const conversationCount = data.conversations.length

  return (
    <div className="card stack">
      <div className="row spread">
        <div className="row">
          <h1>Session {shortId(session.sessionId)}</h1>
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
          ['User', session.userId],
          ['Talking to', avatarName(data, session.activeAvatarId)],
          [
            'Turns',
            `${String(data.turnCount)} in ${String(conversationCount)} conversation${conversationCount === 1 ? '' : 's'}`,
          ],
          ['Unlocked avatars', unlocked.length > 0 ? unlocked.join(', ') : '—'],
          ['Conversation memory', <ConversationMemory data={data} />],
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

// The working memory the Avatar receives right now: written every third exchange, so it lags the
// latest turns and is absent early in a conversation.
function ConversationMemory({ data }: { data: SessionData }): JSX.Element {
  const current = data.memory.working.current
  if (current === undefined) {
    return <span className="muted">none yet (written after the third exchange)</span>
  }
  return (
    <details>
      <summary className="small">
        {avatarName(data, current.avatarId)} · updated {formatTime(current.updatedAt)} ·{' '}
        {current.unresolvedThreads.length} open threads
      </summary>
      <p className="prewrap" style={{ marginTop: 6 }}>
        {current.summary}
      </p>
      {current.unresolvedThreads.length > 0 ? (
        <TextList items={current.unresolvedThreads} empty="—" />
      ) : null}
    </details>
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
