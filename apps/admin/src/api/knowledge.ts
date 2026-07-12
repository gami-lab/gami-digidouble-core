import type {
  CreateKnowledgeSourceRequest,
  CreateKnowledgeSourceResponse,
  DeleteKnowledgeSourceResponse,
  GetIngestionJobResponse,
  IngestionJobDto,
  KnowledgeChunkDto,
  KnowledgeSourceDto,
  ListIngestionJobsResponse,
  ListKnowledgeChunksResponse,
  ListKnowledgeSourcesResponse,
  QueryKnowledgeRetrievalRequest,
  QueryKnowledgeRetrievalResponse,
  TriggerIngestionResponse,
  TypedKnowledgeRetrievalDto,
  UpdateKnowledgeSourceRequest,
  UpdateKnowledgeSourceResponse,
  UploadKnowledgeSourceRequest,
  UploadKnowledgeSourceResponse,
} from '@gami/shared'
import { adminRequest } from './client'

export type { KnowledgeSourceDto, IngestionJobDto, KnowledgeChunkDto, TypedKnowledgeRetrievalDto }

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

export async function getIngestionJob(ingestionJobId: string): Promise<IngestionJobDto> {
  const payload = await adminRequest<GetIngestionJobResponse>(
    'GET',
    `/v1/ingestion-jobs/${ingestionJobId}`,
  )
  return payload.ingestionJob
}

export async function listIngestionJobs(sourceId: string): Promise<IngestionJobDto[]> {
  const payload = await adminRequest<ListIngestionJobsResponse>(
    'GET',
    `/v1/knowledge-sources/${sourceId}/ingestion-jobs`,
  )
  return payload.jobs
}

export async function listKnowledgeChunks(sourceId: string): Promise<KnowledgeChunkDto[]> {
  const payload = await adminRequest<ListKnowledgeChunksResponse>(
    'GET',
    `/v1/knowledge-sources/${sourceId}/chunks`,
  )
  return payload.chunks
}

export async function queryKnowledgeRetrieval(
  input: QueryKnowledgeRetrievalRequest,
): Promise<TypedKnowledgeRetrievalDto> {
  const payload = await adminRequest<QueryKnowledgeRetrievalResponse>(
    'POST',
    '/v1/admin/knowledge/retrieval',
    input,
  )
  return payload.retrieval
}
