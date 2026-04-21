import { coreRequest } from './client'
import type { Message, SessionSummary } from './sessions'

export type SendMessageParams = {
  avatarId: string
  message: {
    content: string
  }
}

type AvatarMessageMetadata = {
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  costUsd?: number
  triggerSource?: string
}

export type SendMessageResponse = {
  session: SessionSummary
  userMessage: Message
  avatarMessage: Message & {
    metadata: AvatarMessageMetadata
  }
  debug: {
    requestId: string
    model: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}

export async function sendMessage(
  sessionId: string,
  params: SendMessageParams,
): Promise<SendMessageResponse> {
  return coreRequest<SendMessageResponse>('POST', `/v1/conversations/${sessionId}/messages`, params)
}
