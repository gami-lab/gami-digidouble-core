import { coreRequest } from './client'
import type { SendMessageResponse } from '@gami/shared'
export type { SendMessageResponse }

export type SendMessageParams = {
  message: {
    content: string
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
