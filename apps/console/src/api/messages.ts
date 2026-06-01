import { coreRequest } from './client'
import type { SendMessageApiResponse, SendMessageRequest, SendMessageResponse } from '@gami/shared'
export type { SendMessageResponse }

export type SendMessageParams = SendMessageRequest

export async function sendMessage(
  conversationId: string,
  params: SendMessageParams,
): Promise<SendMessageApiResponse> {
  return coreRequest<SendMessageApiResponse>(
    'POST',
    `/v1/conversations/${conversationId}/messages`,
    params,
  )
}
