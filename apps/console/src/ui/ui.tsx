import type { JSX, ReactNode } from 'react'
import { langfuseProjectUrl } from '../env'
import { formatMs } from '../debug/format'

type Tone = 'neutral' | 'ok' | 'warn' | 'error' | 'accent'

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}): JSX.Element {
  return <span className={tone === 'neutral' ? 'badge' : `badge ${tone}`}>{children}</span>
}

type SectionProps = {
  title: ReactNode
  aside?: ReactNode
  defaultOpen?: boolean
  nested?: boolean
  children: ReactNode
}

/** A collapsible block: the summary line says what is inside, the body holds the details. */
export function Section({
  title,
  aside,
  defaultOpen = false,
  nested = false,
  children,
}: SectionProps): JSX.Element {
  return (
    <details className={nested ? 'section nested' : 'section'} open={defaultOpen}>
      <summary>
        <span className="summary-title">{title}</span>
        {aside !== undefined ? <span className="summary-aside">{aside}</span> : null}
      </summary>
      <div className="section-body">{children}</div>
    </details>
  )
}

export function KeyValues({ items }: { items: Array<[string, ReactNode]> }): JSX.Element {
  return (
    <dl className="kv">
      {items.map(([key, value]) => (
        <div key={key} style={{ display: 'contents' }}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Empty({ children }: { children: ReactNode }): JSX.Element {
  return <p className="muted small">{children}</p>
}

export function ErrorText({ error }: { error: string | null }): JSX.Element | null {
  return error === null ? null : <p className="error-text">{error}</p>
}

export function LangfuseTraceLink({
  traceId,
}: {
  traceId: string | undefined
}): JSX.Element | null {
  if (langfuseProjectUrl === null || traceId === undefined) return null
  return (
    <a
      className="small"
      href={`${langfuseProjectUrl}/traces/${encodeURIComponent(traceId)}`}
      target="_blank"
      rel="noreferrer"
    >
      Prompt in Langfuse ↗
    </a>
  )
}

export function LangfuseSessionLink({ sessionId }: { sessionId: string }): JSX.Element | null {
  if (langfuseProjectUrl === null) return null
  return (
    <a
      className="small"
      href={`${langfuseProjectUrl}/sessions/${encodeURIComponent(sessionId)}`}
      target="_blank"
      rel="noreferrer"
    >
      Langfuse session ↗
    </a>
  )
}

export type LatencySegment = { label: string; description: string; ms: number; color: string }

export function LatencyBar({
  segments,
  scaleMs,
}: {
  segments: LatencySegment[]
  scaleMs?: number
}): JSX.Element {
  const total = segments.reduce((sum, segment) => sum + segment.ms, 0)
  const scale = Math.max(scaleMs ?? total, 1)
  return (
    <div
      className="latency-bar"
      title={segments.map((s) => `${s.label}: ${formatMs(s.ms)}`).join('\n')}
    >
      {segments.map((segment) => (
        <span
          key={segment.label}
          style={{ width: `${String((segment.ms / scale) * 100)}%`, background: segment.color }}
        />
      ))}
    </div>
  )
}

export function LatencyLegend({ segments }: { segments: LatencySegment[] }): JSX.Element {
  return (
    <table className="data latency-table">
      <tbody>
        {segments.map((segment) => (
          <tr key={segment.label}>
            <td>
              <i className="swatch" style={{ background: segment.color }} />
              {segment.label}
            </td>
            <td className="muted small">{segment.description}</td>
            <td className="mono">{formatMs(segment.ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function TextList({ items, empty }: { items: string[]; empty: string }): JSX.Element {
  if (items.length === 0) return <Empty>{empty}</Empty>
  return (
    <ul className="plain">
      {items.map((item, index) => (
        <li key={`${String(index)}-${item}`}>{item}</li>
      ))}
    </ul>
  )
}
