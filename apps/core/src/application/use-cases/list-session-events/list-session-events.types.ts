import type {
  GmSessionEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'
export type { GmSessionEventPayload, SessionEventRecord, TurnCompletedEventPayload }

export interface ListSessionEventsInput {
  sessionId: string
  limit?: number
}

export interface ListSessionEventsOutput {
  events: SessionEventRecord[]
}
