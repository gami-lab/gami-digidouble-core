import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { ListVoicesResponse, VoiceConfiguration, VoiceOption } from '@gami/shared'
import { formatApiError } from '../api/error'
import { listVoices } from '../api/voices'

type VoiceSelectProps = {
  id: string
  label: string
  /** Scenario language; filters the voices and decides the default voice. */
  language: string | undefined
  /** What "Default" uses before the provider default, e.g. "scenario voice" for an avatar. */
  defaultHint?: string
  value: VoiceConfiguration | null
  disabled: boolean
  onChange: (value: VoiceConfiguration | null) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ListVoicesResponse }

/** Voice picker backed by the active text-to-speech provider (`GET /v1/admin/voices`). */
export function VoiceSelect({
  id,
  label,
  language,
  defaultHint,
  value,
  disabled,
  onChange,
}: VoiceSelectProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    listVoices(language)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: formatApiError(error, 'Failed to load voices') })
        }
      })
    return () => {
      cancelled = true
    }
  }, [language])

  const data = state.status === 'ready' ? state.data : { provider: null, voices: [] }
  const provider = data.provider
  const selectedId = value?.voiceId ?? ''
  const selected = data.voices.find((voice) => voice.voiceId === selectedId)
  // A saved voice from another provider (or no longer listed) stays visible until changed.
  const isUnlisted = value !== null && (selected === undefined || value.provider !== provider)

  return (
    <div className="admin-form-group">
      <label htmlFor={id} className="admin-form-label">
        {label}
      </label>
      <select
        id={id}
        className="admin-form-select"
        value={selectedId}
        disabled={disabled || state.status !== 'ready' || provider === null}
        onChange={(event) => {
          const voiceId = event.target.value
          onChange(voiceId === '' || provider === null ? null : { provider, voiceId })
        }}
      >
        <option value="">{formatDefaultOption(defaultHint, data)}</option>
        {isUnlisted ? (
          <option value={selectedId}>
            Unavailable voice: {value.provider} / {value.voiceId}
          </option>
        ) : null}
        {data.voices.map((voice) => (
          <option key={voice.voiceId} value={voice.voiceId}>
            {formatVoice(voice)}
          </option>
        ))}
      </select>
      <VoiceSelectStatus state={state} selected={selected} />
    </div>
  )
}

function VoiceSelectStatus({
  state,
  selected,
}: {
  state: LoadState
  selected: VoiceOption | undefined
}): JSX.Element | null {
  if (state.status === 'loading') return <p className="admin-muted">Loading voices…</p>
  if (state.status === 'error') return <p className="admin-error">{state.message}</p>
  if (state.data.provider === null) {
    return (
      <p className="admin-muted">
        Voice output is disabled. Set TTS_PROVIDER (e.g. gradium) on Core to choose voices.
      </p>
    )
  }
  if (selected?.description !== undefined) {
    return <p className="admin-muted">{selected.description}</p>
  }
  return null
}

function formatDefaultOption(defaultHint: string | undefined, data: ListVoicesResponse): string {
  const defaultVoice = data.voices.find((voice) => voice.voiceId === data.defaultVoiceId)
  const parts = [defaultHint, defaultVoice === undefined ? undefined : formatVoice(defaultVoice)]
  const label = parts.filter((part) => part !== undefined).join(', else ')
  return label.length === 0 ? 'Default' : `Default (${label})`
}

function formatVoice(voice: VoiceOption): string {
  const details = [voice.language, voice.gender].filter((part) => part !== undefined)
  return details.length === 0 ? voice.name : `${voice.name} (${details.join(', ')})`
}
