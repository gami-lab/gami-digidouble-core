export type ListScenariosOutput = {
  scenarios: Array<{
    scenarioId: string
    name: string
    status: 'draft' | 'active' | 'archived'
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }>
}
