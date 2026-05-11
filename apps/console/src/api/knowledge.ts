import { coreRequest } from './client'
import type {
  CreateKnowledgeSourceRequest,
  CreateKnowledgeSourceResponse,
  GetIngestionJobResponse,
  ListIngestionJobsResponse,
  ListKnowledgeSourcesQuery,
  ListKnowledgeSourcesResponse,
  QueryKnowledgeRetrievalRequest,
  QueryKnowledgeRetrievalResponse,
  TriggerIngestionRequest,
  TriggerIngestionResponse,
} from '@gami/shared'

export async function createKnowledgeSource(
  payload: CreateKnowledgeSourceRequest,
): Promise<CreateKnowledgeSourceResponse> {
  return coreRequest<CreateKnowledgeSourceResponse>('POST', '/v1/knowledge-sources', payload)
}

export async function listKnowledgeSources(
  scenarioId: string,
  query?: ListKnowledgeSourcesQuery,
): Promise<ListKnowledgeSourcesResponse> {
  const params = new URLSearchParams()
  if (query?.knowledgeType !== undefined) params.set('knowledgeType', query.knowledgeType)
  if (query?.status !== undefined) params.set('status', query.status)
  const serialized = params.toString()
  const path =
    serialized.length > 0
      ? `/v1/scenarios/${scenarioId}/knowledge-sources?${serialized}`
      : `/v1/scenarios/${scenarioId}/knowledge-sources`
  return coreRequest<ListKnowledgeSourcesResponse>('GET', path)
}

export async function triggerIngestion(
  sourceId: string,
  payload: TriggerIngestionRequest = {},
): Promise<TriggerIngestionResponse> {
  return coreRequest<TriggerIngestionResponse>(
    'POST',
    `/v1/knowledge-sources/${sourceId}/ingest`,
    payload,
  )
}

export async function listIngestionJobs(sourceId: string): Promise<ListIngestionJobsResponse> {
  return coreRequest<ListIngestionJobsResponse>(
    'GET',
    `/v1/knowledge-sources/${sourceId}/ingestion-jobs`,
  )
}

export async function getIngestionJob(ingestionJobId: string): Promise<GetIngestionJobResponse> {
  return coreRequest<GetIngestionJobResponse>('GET', `/v1/ingestion-jobs/${ingestionJobId}`)
}

export async function queryKnowledgeRetrieval(
  payload: QueryKnowledgeRetrievalRequest,
): Promise<QueryKnowledgeRetrievalResponse> {
  return coreRequest<QueryKnowledgeRetrievalResponse>(
    'POST',
    '/v1/admin/knowledge/retrieval',
    payload,
  )
}
