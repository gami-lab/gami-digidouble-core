import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { apiUrl } from './env'

type HealthData = {
  status: 'ok'
  version?: string
}

type ApiResponse<TData> = {
  data: TData | null
  error: {
    code: string
    message: string
  } | null
}

type ConnectivityState =
  | { status: 'loading' }
  | { status: 'connected'; version: string | null }
  | { status: 'unreachable' }

const normalizeApiUrl = (value: string): string => value.replace(/\/$/, '')

const appContainerStyle: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f7f8fa',
  fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  color: '#1f2937',
}

const panelStyle: CSSProperties = {
  width: 'min(640px, 92vw)',
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.06)',
}

const labelStyle: CSSProperties = {
  margin: '12px 0 4px',
  fontWeight: 600,
}

const valueStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

function App(): JSX.Element {
  const [connectivity, setConnectivity] = useState<ConnectivityState>({ status: 'loading' })

  const healthUrl = useMemo(() => `${normalizeApiUrl(apiUrl)}/health`, [])

  useEffect(() => {
    const controller = new AbortController()

    const checkConnectivity = async (): Promise<void> => {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!response.ok) {
          setConnectivity({ status: 'unreachable' })
          return
        }

        const payload = (await response.json()) as ApiResponse<HealthData>

        if (payload.error !== null || payload.data?.status !== 'ok') {
          setConnectivity({ status: 'unreachable' })
          return
        }

        setConnectivity({
          status: 'connected',
          version: payload.data.version ?? null,
        })
      } catch {
        if (!controller.signal.aborted) {
          setConnectivity({ status: 'unreachable' })
        }
      }
    }

    void checkConnectivity()

    return () => {
      controller.abort()
    }
  }, [healthUrl])

  return (
    <main style={appContainerStyle}>
      <section style={panelStyle} aria-live="polite">
        <h1 style={{ marginTop: 0 }}>Gami DigiDouble — Manual Test Console</h1>

        <p style={labelStyle}>API URL</p>
        <p style={valueStyle}>{apiUrl}</p>

        <p style={labelStyle}>Status</p>
        {connectivity.status === 'loading' && <p style={{ margin: 0 }}>Checking connectivity…</p>}
        {connectivity.status === 'connected' && (
          <p style={{ margin: 0, color: '#166534', fontWeight: 700 }}>● Connected</p>
        )}
        {connectivity.status === 'unreachable' && (
          <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>✗ Unreachable</p>
        )}

        <p style={labelStyle}>Core version</p>
        <p style={valueStyle}>
          {connectivity.status === 'connected'
            ? (connectivity.version ?? 'Not exposed')
            : 'Unavailable'}
        </p>
      </section>
    </main>
  )
}

export default App
