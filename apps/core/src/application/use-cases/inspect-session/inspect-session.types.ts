import type {
  AdminSessionInspectResponse,
  SessionSummary,
  SessionTransitionRecord,
} from '@gami/shared'

export interface InspectSessionInput {
  sessionId: string
}

export type { SessionSummary }

export type InspectGmState = AdminSessionInspectResponse['inspect']['gmState']

export type InspectTransitionRecord = SessionTransitionRecord

export type InspectSessionOutput = AdminSessionInspectResponse
