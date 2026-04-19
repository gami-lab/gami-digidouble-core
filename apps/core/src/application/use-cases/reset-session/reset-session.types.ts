export interface ResetSessionInput {
  sessionId: string
}

export interface ResetSessionOutput {
  sessionId: string
  deleted: {
    messages: number
    sessionMemory: boolean
    events: number
  }
}
