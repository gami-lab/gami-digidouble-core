import type { JSX } from 'react'
import { formatMs, formatTokens } from '../../debug/format'
import type { ConsolidationStep, MemoryRun } from '../../debug/session-timeline'
import { Badge, Empty, KeyValues, LangfuseTraceLink, TextList } from '../../ui/ui'

const triggerLabels: Record<MemoryRun['trigger'], string> = {
  post_turn: 'every third exchange',
  conversation_closed: 'conversation closed',
  avatar_switch: 'avatar switch',
  admin_trigger: 'operator',
}

/** One working-memory rewrite: what the compaction LLM produced from the recent messages. */
// eslint-disable-next-line complexity -- render-only branching
export function MemoryRunView({ run }: { run: MemoryRun }): JSX.Element {
  const payload = run.payload
  return (
    <div className="stack">
      <div className="row small">
        <Badge tone={run.status === 'failed' ? 'error' : run.status === 'ok' ? 'ok' : 'accent'}>
          {run.status}
        </Badge>
        <span className="muted">trigger: {triggerLabels[run.trigger]}</span>
      </div>
      {run.status === 'running' ? <Empty>Still running…</Empty> : null}
      {payload?.error !== undefined ? <p className="error-text">{payload.error}</p> : null}
      {payload?.workingSummary !== undefined ? (
        <KeyValues
          items={[
            ['New summary', <span className="prewrap">{payload.workingSummary}</span>],
            ['Open threads', <TextList items={payload.unresolvedThreads ?? []} empty="—" />],
            ['Covered topics', <TextList items={payload.coveredTopics ?? []} empty="—" />],
            [
              'Candidate facts',
              <TextList
                items={(payload.candidateFacts ?? []).map(
                  (fact) => `${fact.category} · ${fact.key}: ${fact.value}`,
                )}
                empty="—"
              />,
            ],
            [
              'Input',
              `${String(payload.messageCount ?? 0)} recent messages (${String(payload.exchangeCount ?? 0)} exchanges)`,
            ],
          ]}
        />
      ) : null}
      {payload !== null ? (
        <p className="small muted">
          {payload.provider ?? ''} {payload.model ?? ''} ·{' '}
          {formatTokens(payload.inputTokens, payload.outputTokens)} · {formatMs(payload.latencyMs)}{' '}
          <LangfuseTraceLink traceId={payload.llmTraceId} />
        </p>
      ) : null}
    </div>
  )
}

export function ConsolidationView({ step }: { step: ConsolidationStep }): JSX.Element {
  const { payload } = step
  if (payload.error !== undefined) return <p className="error-text">{payload.error}</p>
  if (step.kind === 'episodic') {
    return <p className="small muted">Stored as a long-term avatar memory; see “Memory now”.</p>
  }
  return (
    <>
      <TextList
        items={(payload.facts ?? []).map((fact) => `${fact.category} · ${fact.key}: ${fact.value}`)}
        empty="No new facts."
      />
      <LangfuseTraceLink traceId={payload.llmTraceId} />
    </>
  )
}
