import type { ModelConfigResponse } from '@gami/shared'
import { coreRequest } from './client'

type GetModelConfigPayload = {
  modelConfig: ModelConfigResponse
}

type UpdateModelConfigPayload = {
  modelConfig: ModelConfigResponse
}

export type UpdateModelConfigRequest = {
  globalDefault: { provider: string; model: string }
  roleOverrides?: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
}

export async function getModelConfig(): Promise<ModelConfigResponse> {
  const payload = await coreRequest<GetModelConfigPayload>('GET', '/v1/admin/model-config')
  return payload.modelConfig
}

export async function updateModelConfig(
  request: UpdateModelConfigRequest,
): Promise<ModelConfigResponse> {
  const payload = await coreRequest<UpdateModelConfigPayload>(
    'PUT',
    '/v1/admin/model-config',
    request,
  )
  return payload.modelConfig
}
