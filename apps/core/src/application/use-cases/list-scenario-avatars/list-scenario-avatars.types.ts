export type ListScenarioAvatarsInput = {
  scenarioId: string
}

export type ListScenarioAvatarsOutput = {
  avatars: Array<{
    avatarId: string
    scenarioId: string
    name: string
    status: 'draft' | 'active' | 'archived'
    personaPrompt: string
    tone?: string
    description?: string
    adjustments?: string[]
    config: Record<string, unknown>
    availabilityKey?: string
    createdAt: string
    updatedAt: string
  }>
}
