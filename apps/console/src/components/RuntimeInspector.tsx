import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import {
  clearSessionMemory,
  loadRuntimeInspectorViewModel,
  refreshSessionMemory,
  replayGm,
  resetSession,
  subscribeToRuntimeEvents,
  upsertUserPersona,
} from '../api'
import type { RuntimeInspectorViewModel } from '../api'
import type { RuntimeEvent } from '@gami/shared'
import { formatApiError } from '../api/error'
import { buildMemorySnapshot, pushMemorySnapshotHistory } from './memory-evolution'
import { RuntimeInspectorTabContent } from './runtime-inspector-tab-content'
import type { InspectorTab } from './runtime-inspector-tab-content'

type RuntimeInspectorProps = {
  sessionId: string | null
  refreshTrigger: number
  initialTab?: InspectorTab
  tabOrderOverride?: InspectorTab[]
  showTabNavigation?: boolean
  title?: string
}

const tabOrder: InspectorTab[] = [
  'overview',
  'memory',
  'context',
  'events',
  'metrics',
  'persona',
  'actions',
]

const panelStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '10px',
  padding: '14px',
  backgroundColor: '#f9fafb',
  fontSize: '13px',
}

const tabButtonStyle: CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '12px',
  cursor: 'pointer',
}

const activeTabButtonStyle: CSSProperties = {
  ...tabButtonStyle,
  borderColor: '#111827',
  backgroundColor: '#111827',
  color: '#ffffff',
}

const buttonStyle: CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #1f2937',
  borderRadius: '6px',
  backgroundColor: '#ffffff',
  color: '#1f2937',
  fontSize: '12px',
  cursor: 'pointer',
}

export function RuntimeInspector({
  sessionId,
  refreshTrigger,
  initialTab = 'overview',
  tabOrderOverride,
  showTabNavigation = true,
  title = 'Runtime Inspector',
}: RuntimeInspectorProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<InspectorTab>(initialTab)
  const { snapshot, memoryHistory, liveEvents, loading, error, reload } = useRuntimeInspectorData(
    sessionId,
    refreshTrigger,
  )
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const tabs = tabOrderOverride ?? tabOrder

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string): Promise<void> => {
      if (sessionId === null) return
      setActionStatus('Running action...')
      try {
        await action()
        setActionStatus(successMessage)
        await reload()
      } catch (actionError) {
        setActionStatus(formatApiError(actionError, 'Action failed'))
      }
    },
    [reload, sessionId],
  )

  if (sessionId === null) {
    return <div style={panelStyle}>No active session.</div>
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
        <strong>{title}</strong>
        <button type="button" style={buttonStyle} onClick={() => void reload()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {showTabNavigation ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              style={activeTab === tab ? activeTabButtonStyle : tabButtonStyle}
              onClick={() => {
                setActiveTab(tab)
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : (
        <p style={{ marginTop: '12px', marginBottom: 0, color: '#4b5563' }}>
          Section focus: <strong>{activeTab}</strong>
        </p>
      )}
      {error !== null ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      {snapshot !== null ? (
        <RuntimeInspectorTabContent
          tab={activeTab}
          snapshot={snapshot}
          memoryHistory={memoryHistory}
          liveEvents={liveEvents}
          actionStatus={actionStatus}
          onReplayGm={() => {
            void runAction(() => replayGm(sessionId), 'GM replay scheduled')
          }}
          onRefreshMemory={() => {
            void runAction(() => refreshSessionMemory(sessionId), 'Memory refresh scheduled')
          }}
          onClearMemory={() => {
            void runAction(() => clearSessionMemory(sessionId), 'Session-scoped memory cleared')
          }}
          onResetSession={() => {
            void runAction(() => resetSession(sessionId), 'Session reset completed')
          }}
          onUpsertPersona={async (persona) => {
            await runAction(
              () => upsertUserPersona(snapshot.session.userId, persona),
              'Persona updated',
            )
          }}
        />
      ) : null}
    </div>
  )
}

function useRuntimeInspectorData(sessionId: string | null, refreshTrigger: number): {
  snapshot: RuntimeInspectorViewModel | null
  memoryHistory: ReturnType<typeof pushMemorySnapshotHistory>
  liveEvents: RuntimeEvent[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
} {
  const [snapshot, setSnapshot] = useState<RuntimeInspectorViewModel | null>(null)
  const [memoryHistory, setMemoryHistory] = useState<ReturnType<typeof pushMemorySnapshotHistory>>([])
  const [liveEvents, setLiveEvents] = useState<RuntimeEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async (): Promise<void> => {
    if (sessionId === null) {
      setSnapshot(null)
      setMemoryHistory([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await loadRuntimeInspectorViewModel(sessionId, { eventsLimit: 20 })
      setSnapshot(data)
      setMemoryHistory((previous) =>
        pushMemorySnapshotHistory(previous, buildMemorySnapshot(data.memory.layers, data.recentEvents)),
      )
    } catch (nextError) {
      setError(formatApiError(nextError, 'Failed to load runtime inspector'))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void reload()
  }, [reload, refreshTrigger])

  useEffect(() => {
    if (sessionId === null) {
      setLiveEvents([])
      setMemoryHistory([])
      return
    }

    const subscription = subscribeToRuntimeEvents(sessionId, {
      onEvent: (event) => {
        setLiveEvents((previous) => [event, ...previous].slice(0, 30))
      },
      onError: (streamError) => {
        setError(formatApiError(streamError, 'Live event stream disconnected'))
      },
    })

    return () => {
      subscription.close()
    }
  }, [sessionId])

  return {
    snapshot,
    memoryHistory,
    liveEvents,
    loading,
    error,
    reload,
  }
}
