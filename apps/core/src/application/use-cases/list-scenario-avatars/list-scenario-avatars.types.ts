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
    createdAt: string
    updatedAt: string
  }>
}
