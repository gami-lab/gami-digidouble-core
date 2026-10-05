import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type {
  ListVoicesResponse,
  TextToSpeechProviderName,
  VoiceConfiguration,
  VoiceOption,
} from '@gami/shared'
import { formatApiError } from '../api/error'
import { listVoices } from '../api/voices'

type VoiceSelectProps = {
  id: string
  label: string
  /** Scenario language; filters the voices and decides the default voice. */
  language: string | undefined
  /** What "Default" uses before Core's default, e.g. "scenario voice" for an avatar. */
  defaultHint?: string
  value: VoiceConfiguration | null
  disabled: boolean
  onChange: (value: VoiceConfiguration | null) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ListVoicesResponse }

const EMPTY: ListVoicesResponse = {
  defaultProvider: null,
  providers: [],
  provider: null,
  voices: [],
}

/**
 * Text-to-speech provider and voice picker (`GET /v1/admin/voices`). Only providers with an API key
 * on Core are offered; "Default" leaves the choice to the avatar/scenario/Core default.
 */
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
  const selectedProvider = value?.provider

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    listVoices(language, selectedProvider)
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
  }, [language, selectedProvider])

  const data = state.status === 'ready' ? state.data : EMPTY
  const isDisabled = disabled || state.status !== 'ready'

  return (
    <>
      <ProviderPicker
        id={`${id}-provider`}
        label={`${label} provider`}
        defaultHint={defaultHint}
        value={value}
        data={data}
        disabled={isDisabled}
        onChange={onChange}
      />
      <div className="admin-form-group">
        <label htmlFor={id} className="admin-form-label">
          {label}
        </label>
        <VoicePicker
          id={id}
          defaultHint={defaultHint}
          value={value}
          data={data}
          disabled={isDisabled}
          onChange={onChange}
        />
        <VoiceSelectStatus
          state={state}
          selected={data.voices.find((voice) => voice.voiceId === value?.voiceId)}
        />
      </div>
    </>
  )
}

type PickerProps = {
  defaultHint: string | undefined
  value: VoiceConfiguration | null
  data: ListVoicesResponse
  disabled: boolean
  onChange: (value: VoiceConfiguration | null) => void
}

function ProviderPicker({
  id,
  label,
  defaultHint,
  value,
  data,
  disabled,
  onChange,
}: PickerProps & { id: string; label: string }): JSX.Element {
  const selectedProvider = value?.provider
  // A saved provider whose API key was removed stays visible until changed.
  const isUnavailable = selectedProvider !== undefined && !data.providers.includes(selectedProvider)

  return (
    <div className="admin-form-group">
      <label htmlFor={id} className="admin-form-label">
        {label}
      </label>
      <select
        id={id}
        className="admin-form-select"
        value={selectedProvider ?? ''}
        disabled={disabled || (data.providers.length === 0 && value === null)}
        onChange={(event) => {
          const provider = event.target.value as TextToSpeechProviderName | ''
          onChange(provider === '' ? null : { provider })
        }}
      >
        <option value="">{formatDefaultProvider(defaultHint, data.defaultProvider)}</option>
        {isUnavailable ? (
          <option value={selectedProvider}>No API key: {selectedProvider}</option>
        ) : null}
        {data.providers.map((provider) => (
          <option key={provider} value={provider}>
            {provider}
          </option>
        ))}
      </select>
    </div>
  )
}

function VoicePicker({
  id,
  defaultHint,
  value,
  data,
  disabled,
  onChange,
}: PickerProps & { id: string }): JSX.Element {
  const listedProvider = data.provider
  const selectedId = value?.voiceId ?? ''
  // A saved voice that is no longer listed stays visible until changed.
  const isUnlisted = selectedId !== '' && !data.voices.some((voice) => voice.voiceId === selectedId)

  return (
    <select
      id={id}
      className="admin-form-select"
      value={selectedId}
      disabled={disabled || listedProvider === null}
      onChange={(event) => {
        const voiceId = event.target.value
        if (voiceId !== '' && listedProvider !== null) {
          onChange({ provider: listedProvider, voiceId })
        } else {
          onChange(value === null ? null : { provider: value.provider })
        }
      }}
    >
      <option value="">{formatDefaultVoice(defaultHint, data)}</option>
      {isUnlisted ? <option value={selectedId}>Unavailable voice: {selectedId}</option> : null}
      {data.voices.map((voice) => (
        <option key={voice.voiceId} value={voice.voiceId}>
          {formatVoice(voice)}
        </option>
      ))}
    </select>
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
  if (state.data.providers.length === 0) {
    return (
      <p className="admin-muted">
        Voice output is unavailable: no text-to-speech provider has an API key on Core (e.g.
        GRADIUM_API_KEY).
      </p>
    )
  }
  if (state.data.provider === null) {
    return <p className="admin-muted">This provider has no API key on Core; pick another one.</p>
  }
  if (selected?.description !== undefined) {
    return <p className="admin-muted">{selected.description}</p>
  }
  return null
}

function formatDefaultProvider(
  defaultHint: string | undefined,
  defaultProvider: TextToSpeechProviderName | null,
): string {
  const parts = [defaultHint, defaultProvider ?? 'no voice output']
  return `Default (${parts.filter((part) => part !== undefined).join(', else ')})`
}

function formatDefaultVoice(defaultHint: string | undefined, data: ListVoicesResponse): string {
  const defaultVoice = data.voices.find((voice) => voice.voiceId === data.defaultVoiceId)
  const parts = [defaultHint, defaultVoice === undefined ? undefined : formatVoice(defaultVoice)]
  const label = parts.filter((part) => part !== undefined).join(', else ')
  return label.length === 0 ? 'Default' : `Default (${label})`
}

function formatVoice(voice: VoiceOption): string {
  const details = [voice.language, voice.gender].filter((part) => part !== undefined)
  return details.length === 0 ? voice.name : `${voice.name} (${details.join(', ')})`
}
