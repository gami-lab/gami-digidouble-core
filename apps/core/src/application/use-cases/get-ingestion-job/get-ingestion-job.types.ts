import type { IngestionJobDto } from '@gami/shared'

export type GetIngestionJobInput = {
  ingestionJobId: string
}

export type GetIngestionJobOutput = {
  ingestionJob: IngestionJobDto
}

export type ListIngestionJobsInput = {
  sourceId: string
}

export type ListIngestionJobsOutput = {
  jobs: IngestionJobDto[]
}
