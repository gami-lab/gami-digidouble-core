// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListVoicesResponse, VoiceConfiguration } from '@gami/shared'
import { listVoices } from '../api/voices'
import { VoiceSelect } from './VoiceSelect'

vi.mock('../api/voices', () => ({ listVoices: vi.fn() }))

const VOICES: ListVoicesResponse = {
  provider: 'gradium',
  defaultVoiceId: 'voice_claude',
  voices: [
    { voiceId: 'voice_claude', name: 'Claude', language: 'fr', gender: 'male', description: 'Warm' },
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
      expect(screen.getByRole('option', { name: 'Default (scenario voice, else Claude (fr, male))' })).toBeTruthy()
    })
    expect(listVoices).toHaveBeenCalledWith('fr-CH')
  })

  it('emits a provider voice selection, and null when going back to the default', async () => {
    vi.mocked(listVoices).mockResolvedValue(VOICES)
    const onChange = renderSelect({ provider: 'gradium', voiceId: 'voice_claude' })
    await waitFor(() => {
      expect(screen.getByText('Warm')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Avatar voice'), { target: { value: 'voice_solene' } })
    fireEvent.change(screen.getByLabelText('Avatar voice'), { target: { value: '' } })

    expect(onChange).toHaveBeenNthCalledWith(1, { provider: 'gradium', voiceId: 'voice_solene' })
    expect(onChange).toHaveBeenNthCalledWith(2, null)
  })

  it('explains and disables the picker when voice output is off', async () => {
    vi.mocked(listVoices).mockResolvedValue({ provider: null, voices: [] })

    renderSelect(null)

    await waitFor(() => {
      expect(screen.getByText(/Voice output is disabled/)).toBeTruthy()
    })
    expect(screen.getByLabelText('Avatar voice')).toHaveProperty('disabled', true)
  })

  it('keeps a saved voice that is no longer listed visible', async () => {
    vi.mocked(listVoices).mockResolvedValue(VOICES)

    renderSelect({ provider: 'gradium', voiceId: 'voice_removed' })

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Unavailable voice: gradium / voice_removed' }),
      ).toBeTruthy()
    })
  })
})
