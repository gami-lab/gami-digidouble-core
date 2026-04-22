import { coreRequest } from './client'
import type { ConversationSummary, Message, SessionSummary } from './sessions'

export type SendMessageParams = {
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
  conversation: ConversationSummary
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
  conversationId: string,
  params: SendMessageParams,
): Promise<SendMessageResponse> {
  return coreRequest<SendMessageResponse>(
    'POST',
    `/v1/conversations/${conversationId}/messages`,
    params,
  )
}
