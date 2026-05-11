import type { IngestionJobDto } from '@gami/shared'

export type TriggerIngestionInput = {
  sourceId: string
  correlationId?: string
}

export type TriggerIngestionOutput = {
  ingestionJob: IngestionJobDto
  scheduled: boolean
}
