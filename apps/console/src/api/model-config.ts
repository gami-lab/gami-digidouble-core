import type { ModelConfigResponse, UpdateModelConfigRequest } from '@gami/shared'
import { coreRequest } from './client'

export type { UpdateModelConfigRequest }

type GetModelConfigPayload = {
  modelConfig: ModelConfigResponse
}

type UpdateModelConfigPayload = {
  modelConfig: ModelConfigResponse
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
