import { coreRequest } from './client'
import type {
  ListIngestionJobsResponse,
  ListKnowledgeChunksResponse,
  ListKnowledgeSourcesResponse,
  QueryKnowledgeRetrievalRequest,
  QueryKnowledgeRetrievalResponse,
} from '@gami/shared'

export async function listKnowledgeSources(
  scenarioId: string,
): Promise<ListKnowledgeSourcesResponse> {
  return coreRequest<ListKnowledgeSourcesResponse>(
    'GET',
    `/v1/scenarios/${scenarioId}/knowledge-sources`,
  )
}

export async function listIngestionJobs(sourceId: string): Promise<ListIngestionJobsResponse> {
  return coreRequest<ListIngestionJobsResponse>(
    'GET',
    `/v1/knowledge-sources/${sourceId}/ingestion-jobs`,
  )
}

export async function listKnowledgeChunks(sourceId: string): Promise<ListKnowledgeChunksResponse> {
  return coreRequest<ListKnowledgeChunksResponse>('GET', `/v1/knowledge-sources/${sourceId}/chunks`)
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
