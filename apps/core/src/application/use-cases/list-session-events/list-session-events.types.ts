import type {
  AdminSessionEventsResponse,
  GmSessionEventPayload,
  MemoryRefreshEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'
export type {
  GmSessionEventPayload,
  MemoryRefreshEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
}

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export type ListSessionEventsOutput = AdminSessionEventsResponse
