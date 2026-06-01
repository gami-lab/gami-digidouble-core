import type {
  ConversationSummary,
  SendMessageApiResponse,
  SendMessageRequest,
  StartConversationRequest,
  StartConversationResponse,
} from '@gami/shared'
import { webRequest } from './client'

export async function startConversation(
  sessionId: string,
  request: StartConversationRequest,
): Promise<ConversationSummary> {
  const payload = await webRequest<StartConversationResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations`,
    request,
  )

  return payload.conversation
}

export async function sendMessage(
  conversationId: string,
  request: SendMessageRequest,
): Promise<SendMessageApiResponse> {
  return webRequest<SendMessageApiResponse>(
    'POST',
    `/v1/conversations/${conversationId}/messages`,
    request,
  )
}
