import type { JSX } from 'react'
import type { AdminSessionMemoryLayersResponse } from '@gami/shared'

type MemoryLayers = AdminSessionMemoryLayersResponse['session']

export function MemoryObservabilitySection({ layers }: { layers: MemoryLayers }): JSX.Element {
  const selection = readSelectionFields(layers)
  const hydration = readHydrationFields(layers)

  return (
    <>
      <strong style={{ display: 'block', marginTop: '12px' }}>Selection observability</strong>
      <Row label="Selected vs rejected">{`${String(selection.selectedCount)} / ${String(selection.rejectedCount)}`}</Row>
      <Row label="Top reasons">{selection.topReasons}</Row>
      <Row label="Selection sources">{selection.selectionSources}</Row>

      <strong style={{ display: 'block', marginTop: '12px' }}>Hydration observability</strong>
      <Row label="Hydrated conversation">{hydration.hydratedConversationId}</Row>
      <Row label="Hydration sources">{hydration.hydrationSources}</Row>
      <Row label="Hydrated at">{hydration.hydratedAt}</Row>
    </>
  )
}

function readSelectionFields(layers: MemoryLayers): {
  selectedCount: number
  rejectedCount: number
  topReasons: string
  selectionSources: string
} {
  const selection = layers.observability?.selection
  return {
    selectedCount: selection?.selectedCount ?? 0,
    rejectedCount: selection?.rejectedCount ?? 0,
    topReasons: selection?.topSelectionReasons.join(', ') || '-',
    selectionSources: selection?.sourceConversationIds.join(', ') || '-',
  }
}

function readHydrationFields(layers: MemoryLayers): {
  hydratedConversationId: string
  hydrationSources: string
  hydratedAt: string
} {
  const hydration = layers.observability?.hydration
  return {
    hydratedConversationId: hydration?.hydratedConversationId ?? '-',
    hydrationSources: hydration?.sourceConversationIds.join(', ') || '-',
    hydratedAt: hydration?.hydratedAt ?? '-',
  }
}

function Row({ label, children }: { label: string; children: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
      <span style={{ fontWeight: 600, color: '#374151', flexShrink: 0, width: '170px' }}>
        {label}
      </span>
      <span style={{ color: '#111827', wordBreak: 'break-word' }}>{children}</span>
    </div>
  )
}
