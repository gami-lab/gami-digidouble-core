export type RunIngestionJobInput = {
  ingestionJobId: string
  correlationId?: string
}

export type RunIngestionJobOutput = {
  ingestionJobId: string
  sourceId: string
  status: 'completed' | 'failed'
  chunkCount?: number
  errorMessage?: string
}
