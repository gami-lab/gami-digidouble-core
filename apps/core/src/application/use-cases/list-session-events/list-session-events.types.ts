import type {
  AdminSessionEventsResponse,
  GmSessionEventPayload,
  MemoryConsolidationEventPayload,
  MemoryRefreshEventPayload,
  MessageAudioEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'
export type {
  GmSessionEventPayload,
  MemoryConsolidationEventPayload,
  MemoryRefreshEventPayload,
  MessageAudioEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
}

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export type ListSessionEventsOutput = AdminSessionEventsResponse
