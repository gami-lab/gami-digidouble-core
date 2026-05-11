export type RetryIngestionJobInput = {
  ingestionJobId: string
  correlationId?: string
}

export type RetryIngestionJobOutput = {
  previousIngestionJobId: string
  retryIngestionJobId: string
  sourceId: string
  status: 'queued'
}
