import type { ModelConfigResponse, UpdateModelConfigRequest } from '@gami/shared'
import { adminRequest } from './client'

export async function getModelConfig(): Promise<ModelConfigResponse> {
  const payload = await adminRequest<{ modelConfig: ModelConfigResponse }>(
    'GET',
    '/v1/admin/model-config',
  )
  return payload.modelConfig
}

export async function updateModelConfig(
  input: UpdateModelConfigRequest,
): Promise<ModelConfigResponse> {
  const payload = await adminRequest<{ modelConfig: ModelConfigResponse }>(
    'PUT',
    '/v1/admin/model-config',
    input,
  )
  return payload.modelConfig
}
