import type { IngestionJobDto } from '@gami/shared'

export type TriggerIngestionInput = {
  sourceId: string
  correlationId?: string
  chunkSize?: number
}

export type TriggerIngestionOutput = {
  ingestionJob: IngestionJobDto
  scheduled: boolean
}
