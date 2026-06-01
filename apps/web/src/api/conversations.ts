import type {
  ConversationHistoryApiResponse,
  ConversationSummary,
  EndConversationApiResponse,
  EndConversationRequest,
  EndConversationResponse,
  GetHistoryResponse,
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

export async function getConversationHistory(conversationId: string): Promise<GetHistoryResponse> {
  return webRequest<ConversationHistoryApiResponse>(
    'GET',
    `/v1/conversations/${conversationId}/history`,
  )
}

export async function endConversation(
  sessionId: string,
  conversationId: string,
  reason?: EndConversationRequest['reason'],
): Promise<EndConversationResponse> {
  const body: EndConversationRequest = reason !== undefined ? { reason } : {}
  return webRequest<EndConversationApiResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations/${conversationId}/end`,
    body,
  )
}
