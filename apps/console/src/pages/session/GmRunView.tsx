import type { JSX } from 'react'
import type { GmSessionEventPayload, RecordedGmContextSnapshot } from '@gami/shared'
import { formatMs, formatTokens } from '../../debug/format'
import { RetrievalView } from '../../debug/RetrievalView'
import type { GmRun } from '../../debug/session-timeline'
import { Badge, Empty, KeyValues, LangfuseTraceLink, Section, TextList } from '../../ui/ui'
import { MemoryInputsView } from './AvatarContextView'
import { avatarName } from './SessionHeader'
import type { SessionData } from './use-session-data'

// eslint-disable-next-line complexity -- render-only branching
export function gmSummary(run: GmRun | null, hasGm: boolean): JSX.Element {
  if (run === null) return <span className="small muted">{hasGm ? 'pending' : 'disabled'}</span>
  if (run.status === 'error') return <Badge tone="error">{run.payload.errorCode ?? 'error'}</Badge>
  const decision = run.payload.decision
  return (
    <>
      {decision !== undefined ? <Badge>{decision.dialogueMode}</Badge> : null}
      {decision?.routingAction !== undefined && decision.routingAction !== 'stay' ? (
        <Badge tone="warn">{decision.routingAction}</Badge>
      ) : null}
      {decision?.notesInjected === true ? <Badge tone="accent">note</Badge> : null}
      {decision?.progression === 'increase' ? <Badge tone="ok">progressed</Badge> : null}
    </>
  )
}

export function GmRunView({ run, data }: { run: GmRun; data: SessionData }): JSX.Element {
  const { payload } = run
  return (
    <>
      {run.status === 'error' ? (
        <p className="error-text">
          GM failed: {payload.errorCode ?? 'unknown error'}. No decision was applied.
        </p>
      ) : null}
      {payload.decision !== undefined ? <DecisionView payload={payload} data={data} /> : null}
      <p className="small muted">
        Trigger {payload.triggerReason ?? '—'} · {payload.provider ?? ''} {payload.model ?? ''} ·{' '}
        {formatTokens(payload.inputTokens, payload.outputTokens)} · LLM{' '}
        {formatMs(payload.latencyMs)}
        {payload.totalLatencyMs !== undefined
          ? ` · total ${formatMs(payload.totalLatencyMs)}`
          : ''}{' '}
        <LangfuseTraceLink traceId={payload.llmTraceId} />
      </p>
      {payload.gmContext !== undefined ? (
        <Section
          nested
          title="What the GM saw"
          aside={<span className="muted small">inputs to its decision</span>}
        >
          <GmContextView context={payload.gmContext} data={data} />
        </Section>
      ) : null}
    </>
  )
}

// eslint-disable-next-line complexity -- render-only branching
function DecisionView({
  payload,
  data,
}: {
  payload: GmSessionEventPayload
  data: SessionData
}): JSX.Element | null {
  const decision = payload.decision
  if (decision === undefined) return null
  const progression =
    payload.stateAfter !== undefined &&
    payload.stateAfter.progression !== payload.stateBefore.progression
      ? `“${payload.stateBefore.progression}” → “${payload.stateAfter.progression}”`
      : `unchanged (“${payload.stateBefore.progression}”)`

  return (
    <KeyValues
      items={[
        [
          'Dialogue mode',
          `${decision.dialogueMode}${decision.askFollowUp ? ' · ask a follow-up' : ''}`,
        ],
        [
          'Routing',
          decision.routingAction === undefined || decision.routingAction === 'stay'
            ? 'stay with the current avatar'
            : `${decision.routingAction} → ${avatarName(data, decision.routingAvatarId ?? decision.switchedAvatarId)}${
                decision.routingReason !== undefined ? ` — ${decision.routingReason}` : ''
              }`,
        ],
        [
          'Director note for next turn',
          decision.injectedNote ?? <span className="muted">none</span>,
        ],
        [
          'Retrieval plan for next turn',
          decision.retrievalPlan === undefined ? (
            <span className="muted">none</span>
          ) : (
            <TextList
              items={[
                ...decision.retrievalPlan.queries.map((query) => `query: ${query}`),
                ...decision.retrievalPlan.requiredFacts.map((fact) => `fact: ${fact}`),
              ]}
              empty="empty plan"
            />
          ),
        ],
        [
          'Progression',
          `${progression}${decision.objectiveId !== undefined ? ` · objective ${decision.objectiveId}` : ''}`,
        ],
        ...(decision.unlockEvaluations !== undefined && decision.unlockEvaluations.length > 0
          ? [
              [
                'Unlock evaluations',
                <TextList
                  items={decision.unlockEvaluations.map(
                    (evaluation) =>
                      `${evaluation.avatarName}: ${evaluation.outcome}${evaluation.reason !== undefined ? ` — ${evaluation.reason}` : ''}`,
                  )}
                  empty="—"
                />,
              ] as [string, JSX.Element],
            ]
          : []),
      ]}
    />
  )
}

function GmContextView({
  context,
  data,
}: {
  context: RecordedGmContextSnapshot
  data: SessionData
}): JSX.Element {
  const { sections } = context
  const retrieved = sections.retrievedContext
  return (
    <>
      <KeyValues
        items={[
          [
            'Avatars',
            context.availableAvatars
              .map(
                (avatar) => `${avatar.name}${avatar.availability === 'locked' ? ' (locked)' : ''}`,
              )
              .join(', ') || '—',
          ],
          ['Persona', sections.userPersona?.name ?? <span className="muted">none</span>],
        ]}
      />
      <Section
        nested
        title={`Recent messages (${String(sections.conversationState.recentMessages.length)})`}
      >
        {sections.conversationState.recentMessages.length === 0 ? (
          <Empty>None</Empty>
        ) : (
          sections.conversationState.recentMessages.map((message, index) => (
            <p key={`${String(index)}-${message.role}`} className="small prewrap">
              <strong>{message.role}:</strong> {message.content}
            </p>
          ))
        )}
      </Section>
      <MemoryInputsView
        workingSummary={sections.conversationState.workingMemory?.summary}
        episodicMemories={sections.conversationState.episodicMemories}
        longTermFacts={sections.conversationState.longTermFacts}
      />
      {retrieved !== undefined ? (
        <Section nested title="Knowledge the GM retrieved">
          <RetrievalView trace={retrieved.trace} items={retrieved} sourceNames={data.sourceNames} />
        </Section>
      ) : null}
    </>
  )
}
