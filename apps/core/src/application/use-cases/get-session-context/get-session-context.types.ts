import type { ShortTermMemoryExchange } from '../../../domain/memory/memory.types.js'

export type GetSessionContextInput = {
  sessionId: string
}

export type GetSessionContextOutput = {
  sessionId: string
  avatarPrompt: string | null
  worldContext: string | null
  worldObjectives: string[]
  gmInstruction: string | null
  workingMemory: {
    summary: string
    unresolvedThreads: string[]
    updatedAt: string
  } | null
  currentExchanges: ShortTermMemoryExchange[]
}
