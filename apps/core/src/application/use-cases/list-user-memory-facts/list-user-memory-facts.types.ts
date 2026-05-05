import type { UserFact } from '../../../domain/memory/memory.types.js'

export type ListUserMemoryFactsInput = {
  userId: string
}

export type ListUserMemoryFactsOutput = {
  facts: UserFact[]
}
