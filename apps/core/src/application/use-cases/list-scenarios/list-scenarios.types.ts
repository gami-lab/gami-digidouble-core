export type ListScenariosOutput = {
  scenarios: Array<{
    scenarioId: string
    name: string
    status: 'draft' | 'active' | 'archived'
    createdAt: string
    updatedAt: string
  }>
}
