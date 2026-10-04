import type { JSX } from 'react'
import type { AdminSessionContextResponse, SessionContextTrace } from '@gami/shared'
import { getSessionContext } from '../../api/sessions'
import { RetrievalView } from '../../debug/RetrievalView'
import { Badge, Empty, ErrorText, KeyValues, Section, TextList } from '../../ui/ui'
import { useAsync } from '../../ui/use-async'
import { MemoryInputsView } from './AvatarContextView'
import type { SessionData } from './use-session-data'

/** What the next turn would assemble right now, with the budget decisions behind it. */
export function ContextView({
  sessionId,
  data,
}: {
  sessionId: string
  data: SessionData
}): JSX.Element {
  const context = useAsync(() => getSessionContext(sessionId), [sessionId, data])
  const response = context.data

  return (
    <div className="stack">
      <p className="muted">
        A dry run of context assembly for the next turn. Retrieval here uses the last user message,
        so it can differ from what the next message will retrieve.
      </p>
      <ErrorText error={context.error} />
      {response === null ? (
        context.error === null ? (
          <Empty>Assembling context…</Empty>
        ) : null
      ) : (
        <ContextSections response={response} data={data} />
      )}
    </div>
  )
}

function BudgetAside({ trace }: { trace: SessionContextTrace }): JSX.Element {
  const trimmed = trace.selection.trimmed.length
  return trimmed > 0 ? (
    <Badge tone="warn">{trimmed} segments trimmed</Badge>
  ) : (
    <Badge tone="ok">everything fits</Badge>
  )
}

function BudgetTable({ trace }: { trace: SessionContextTrace }): JSX.Element {
  const rows = [
    ...trace.selection.kept.map((segment) => ({ ...segment, kept: true })),
    ...trace.selection.trimmed.map((segment) => ({ ...segment, kept: false })),
  ]
  const used = (projection: 'avatar' | 'gm'): number =>
    trace.selection.kept
      .filter((s) => s.projection === projection)
      .reduce((sum, s) => sum + s.tokenEstimate, 0)

  return (
    <>
      <p className="small muted">
        Avatar {used('avatar')} / {trace.policy.tokenBudget.avatarMaxTokens} tokens · GM{' '}
        {used('gm')} / {trace.policy.tokenBudget.gmMaxTokens} tokens (estimates)
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Projection</th>
            <th>Segment</th>
            <th>Tokens</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.projection}-${row.segmentId}`}>
              <td>{row.projection}</td>
              <td>{row.segmentId}</td>
              <td className="mono">{row.tokenEstimate}</td>
              <td>
                <Badge tone={row.kept ? (row.reason === 'protected' ? 'accent' : 'ok') : 'warn'}>
                  {row.reason}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function ContextSections({
  response,
  data,
}: {
  response: AdminSessionContextResponse
  data: SessionData
}): JSX.Element {
  return (
    <>
      <Section
        defaultOpen
        title="Token budget"
        aside={<BudgetAside trace={response.contextTrace} />}
      >
        <BudgetTable trace={response.contextTrace} />
      </Section>
      <Section
        title="Avatar projection"
        aside={<span className="small muted">what the Avatar prompt is built from</span>}
      >
        <KeyValues
          items={[
            [
              'Director note',
              response.avatarContext.sections.directorNotes ?? <span className="muted">none</span>,
            ],
            [
              'Response rules',
              <TextList items={response.avatarContext.sections.responseRules.items} empty="None" />,
            ],
          ]}
        />
        <MemoryInputsView
          workingSummary={
            response.avatarContext.sections.conversationState.workingMemory.conversation?.summary
          }
          episodicMemories={response.avatarContext.sections.conversationState.episodicMemories}
          longTermFacts={response.avatarContext.sections.conversationState.longTermFacts}
        />
        {response.avatarContext.sections.retrievedContext?.typedSections !== undefined ? (
          <Section nested title="Retrieved knowledge">
            <RetrievalView
              trace={response.avatarContext.sections.retrievedContext.typedSections.trace}
              items={response.avatarContext.sections.retrievedContext.typedSections}
              sourceNames={data.sourceNames}
            />
          </Section>
        ) : null}
      </Section>
      <Section
        title="Game Master projection"
        aside={
          <span className="small muted">
            progression “{response.gmContext.currentState.progression}”
          </span>
        }
      >
        <MemoryInputsView
          workingSummary={response.gmContext.sections.conversationState.workingMemory?.summary}
          episodicMemories={response.gmContext.sections.conversationState.episodicMemories}
          longTermFacts={response.gmContext.sections.conversationState.longTermFacts}
        />
        {response.gmContext.sections.retrievedContext !== undefined ? (
          <Section nested title="Retrieved knowledge (unrestricted)">
            <RetrievalView
              trace={response.gmContext.sections.retrievedContext.trace}
              items={response.gmContext.sections.retrievedContext}
              sourceNames={data.sourceNames}
            />
          </Section>
        ) : null}
      </Section>
      <Section title="Assembly rationale">
        <KeyValues
          items={[
            [
              'Avatar',
              <TextList items={response.contextTrace.rationale.avatarProjection} empty="—" />,
            ],
            ['GM', <TextList items={response.contextTrace.rationale.gmProjection} empty="—" />],
          ]}
        />
      </Section>
    </>
  )
}
