import type {
  AdminSessionEventsResponse,
  GmSessionEventPayload,
  MemoryConsolidationEventPayload,
  MemoryRefreshEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'
export type {
  GmSessionEventPayload,
  MemoryConsolidationEventPayload,
  MemoryRefreshEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
}

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export type ListSessionEventsOutput = AdminSessionEventsResponse
