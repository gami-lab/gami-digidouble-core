import { describe, expect, it } from 'vitest'
import { derivePersonaStartGate } from './debug-shell-persona-gate'

describe('derivePersonaStartGate', () => {
  it('blocks session start before persona is ready', () => {
    const blocked = derivePersonaStartGate({
      personaReady: false,
      isLoadingPersona: false,
      isSavingPersona: false,
    })

    expect(blocked.canStartSession).toBe(false)
    expect(blocked.startBlockedReason).toBe('Save persona first to start debugging session.')
  })

  it('keeps session start blocked while persona load or save is in progress', () => {
    const loading = derivePersonaStartGate({
      personaReady: true,
      isLoadingPersona: true,
      isSavingPersona: false,
    })
    const saving = derivePersonaStartGate({
      personaReady: true,
      isLoadingPersona: false,
      isSavingPersona: true,
    })

    expect(loading.canStartSession).toBe(false)
    expect(saving.canStartSession).toBe(false)
  })

  it('allows session start after persona is ready and stable', () => {
    const allowed = derivePersonaStartGate({
      personaReady: true,
      isLoadingPersona: false,
      isSavingPersona: false,
    })

    expect(allowed.canStartSession).toBe(true)
    expect(allowed.startBlockedReason).toBeNull()
  })
})
