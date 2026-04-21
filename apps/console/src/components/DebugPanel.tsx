import { useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'

export type DebugMetadata = {
  model?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
}

type DebugPanelProps = {
  metadata: DebugMetadata
}

const debugToggleStyle: CSSProperties = {
  marginTop: '8px',
  border: 'none',
  backgroundColor: 'transparent',
  color: '#1f2937',
  padding: 0,
  fontSize: '13px',
  cursor: 'pointer',
}

const debugPanelStyle: CSSProperties = {
  marginTop: '8px',
  padding: '8px',
  borderRadius: '6px',
  border: '1px solid #bfdbfe',
  backgroundColor: '#eff6ff',
  fontSize: '13px',
}

const debugRowStyle: CSSProperties = {
  margin: 0,
}

export function DebugPanel({ metadata }: DebugPanelProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false)
  const rows = useMemo(() => {
    const nextRows: string[] = []
    if (metadata.model !== undefined) {
      nextRows.push(`model: ${metadata.model}`)
    }
    if (metadata.latencyMs !== undefined) {
      nextRows.push(`latency: ${metadata.latencyMs} ms`)
    }
    if (metadata.inputTokens !== undefined) {
      nextRows.push(`input tokens: ${metadata.inputTokens}`)
    }
    if (metadata.outputTokens !== undefined) {
      nextRows.push(`output tokens: ${metadata.outputTokens}`)
    }
    return nextRows
  }, [metadata.inputTokens, metadata.latencyMs, metadata.model, metadata.outputTokens])

  if (rows.length === 0) {
    return null
  }

  return (
    <div>
      <button
        type="button"
        style={debugToggleStyle}
        onClick={() => {
          setIsOpen((current) => !current)
        }}
      >
        {isOpen ? '[▼ debug]' : '[▶ debug]'}
      </button>
      {isOpen ? (
        <div style={debugPanelStyle}>
          {rows.map((row) => (
            <p key={row} style={debugRowStyle}>
              {row}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
