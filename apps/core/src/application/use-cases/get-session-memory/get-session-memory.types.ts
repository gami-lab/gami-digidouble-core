import type { SessionMemorySummary } from '@gami/shared'

export type GetSessionMemoryInput = {
  sessionId: string
}

export type GetSessionMemoryOutput = {
  memorySummary: SessionMemorySummary
}
