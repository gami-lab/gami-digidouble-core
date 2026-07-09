import type {
  CreateKnowledgeSourceRequest,
  CreateKnowledgeSourceResponse,
  DeleteKnowledgeSourceResponse,
  IngestionJobDto,
  KnowledgeSourceDto,
  ListKnowledgeSourcesResponse,
  TriggerIngestionResponse,
  UpdateKnowledgeSourceRequest,
  UpdateKnowledgeSourceResponse,
  UploadKnowledgeSourceRequest,
  UploadKnowledgeSourceResponse,
} from '@gami/shared'
import { adminRequest } from './client'

export type { KnowledgeSourceDto, IngestionJobDto }

export async function listKnowledgeSources(scenarioId: string): Promise<KnowledgeSourceDto[]> {
  const payload = await adminRequest<ListKnowledgeSourcesResponse>(
    'GET',
    `/v1/scenarios/${scenarioId}/knowledge-sources`,
  )
  return payload.sources
}

export async function createKnowledgeSource(
  input: CreateKnowledgeSourceRequest,
): Promise<KnowledgeSourceDto> {
  const payload = await adminRequest<CreateKnowledgeSourceResponse>(
    'POST',
    '/v1/knowledge-sources',
    input,
  )
  return payload.source
}

export async function uploadKnowledgeSource(
  input: UploadKnowledgeSourceRequest,
): Promise<KnowledgeSourceDto> {
  const payload = await adminRequest<UploadKnowledgeSourceResponse>(
    'POST',
    '/v1/knowledge-sources/upload',
    input,
  )
  return payload.source
}

export async function updateKnowledgeSource(
  sourceId: string,
  input: UpdateKnowledgeSourceRequest,
): Promise<KnowledgeSourceDto> {
  const payload = await adminRequest<UpdateKnowledgeSourceResponse>(
    'PATCH',
    `/v1/knowledge-sources/${sourceId}`,
    input,
  )
  return payload.source
}

export async function deleteKnowledgeSource(sourceId: string): Promise<void> {
  await adminRequest<DeleteKnowledgeSourceResponse>('DELETE', `/v1/knowledge-sources/${sourceId}`)
}

export async function triggerIngestion(sourceId: string): Promise<IngestionJobDto> {
  const payload = await adminRequest<TriggerIngestionResponse>(
    'POST',
    `/v1/knowledge-sources/${sourceId}/ingest`,
    {},
  )
  return payload.ingestionJob
}
