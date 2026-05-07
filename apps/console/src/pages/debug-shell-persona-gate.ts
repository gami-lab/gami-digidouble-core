export type PersonaStartGateInput = {
  personaReady: boolean
  isLoadingPersona: boolean
  isSavingPersona: boolean
}

export type PersonaStartGateState = {
  canStartSession: boolean
  startBlockedReason: string | null
}

export function derivePersonaStartGate(input: PersonaStartGateInput): PersonaStartGateState {
  const canStartSession = input.personaReady && !input.isLoadingPersona && !input.isSavingPersona

  return {
    canStartSession,
    startBlockedReason: canStartSession ? null : 'Save persona first to start debugging session.',
  }
}
