// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListVoicesResponse, VoiceConfiguration } from '@gami/shared'
import { listVoices } from '../api/voices'
import { VoiceSelect } from './VoiceSelect'

vi.mock('../api/voices', () => ({ listVoices: vi.fn() }))

const VOICES: ListVoicesResponse = {
  defaultProvider: 'gradium',
  providers: ['gradium'],
  provider: 'gradium',
  defaultVoiceId: 'voice_claude',
  voices: [
    {
      voiceId: 'voice_claude',
      name: 'Claude',
      language: 'fr',
      gender: 'male',
      description: 'Warm',
    },
    { voiceId: 'voice_solene', name: 'Solène', language: 'fr', gender: 'female' },
  ],
}

function renderSelect(value: VoiceConfiguration | null, onChange = vi.fn()): typeof onChange {
  render(
    <VoiceSelect
      id="voice"
      label="Avatar voice"
      language="fr-CH"
      defaultHint="scenario voice"
      value={value}
      disabled={false}
      onChange={onChange}
    />,
  )
  return onChange
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('VoiceSelect', () => {
  it('loads voices for the scenario language and names the automatic default', async () => {
    vi.mocked(listVoices).mockResolvedValue(VOICES)

    renderSelect(null)

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Default (scenario voice, else Claude (fr, male))' }),
      ).toBeTruthy()
    })
    expect(listVoices).toHaveBeenCalledWith('fr-CH', undefined)
    expect(
      screen.getByRole('option', { name: 'Default (scenario voice, else gradium)' }),
    ).toBeTruthy()
  })

  it('lets the admin pin a provider with its default voice, and go back to the default', async () => {
    vi.mocked(listVoices).mockResolvedValue(VOICES)
    const onChange = renderSelect(null)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'gradium' })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Avatar voice provider'), {
      target: { value: 'gradium' },
    })
    expect(onChange).toHaveBeenLastCalledWith({ provider: 'gradium' })

    cleanup()
    const onPinnedChange = renderSelect({ provider: 'gradium', voiceId: 'voice_solene' })
    await waitFor(() => {
      expect(listVoices).toHaveBeenLastCalledWith('fr-CH', 'gradium')
    })
    fireEvent.change(screen.getByLabelText('Avatar voice'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Avatar voice provider'), { target: { value: '' } })
    expect(onPinnedChange).toHaveBeenNthCalledWith(1, { provider: 'gradium' })
    expect(onPinnedChange).toHaveBeenNthCalledWith(2, null)
  })

  it('emits a provider voice selection from the default provider voices', async () => {
    vi.mocked(listVoices).mockResolvedValue(VOICES)
    const onChange = renderSelect(null)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Solène (fr, female)' })).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Avatar voice'), { target: { value: 'voice_solene' } })

    expect(onChange).toHaveBeenCalledWith({ provider: 'gradium', voiceId: 'voice_solene' })
  })

  it('explains and disables the pickers when no provider has an API key', async () => {
    vi.mocked(listVoices).mockResolvedValue({
      defaultProvider: null,
      providers: [],
      provider: null,
      voices: [],
    })

    renderSelect(null)

    await waitFor(() => {
      expect(screen.getByText(/Voice output is unavailable/)).toBeTruthy()
    })
    expect(screen.getByLabelText('Avatar voice provider')).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('Avatar voice')).toHaveProperty('disabled', true)
  })

  it('flags a saved provider without an API key so it can be changed before saving', async () => {
    vi.mocked(listVoices).mockResolvedValue({
      defaultProvider: null,
      providers: [],
      provider: null,
      voices: [],
    })

    renderSelect({ provider: 'gradium', voiceId: 'voice_claude' })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'No API key: gradium' })).toBeTruthy()
    })
    expect(screen.getByText(/saving will be rejected/)).toBeTruthy()
    expect(screen.getByLabelText('Avatar voice provider')).toHaveProperty('disabled', false)
  })

  it('keeps a saved voice that is no longer listed visible', async () => {
    vi.mocked(listVoices).mockResolvedValue(VOICES)

    renderSelect({ provider: 'gradium', voiceId: 'voice_removed' })

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Unavailable voice: voice_removed' })).toBeTruthy()
    })
  })
})
