import { describe, expect, it } from 'vitest'
import { langfuseTraceId } from './langfuse-trace-id'

describe('langfuseTraceId', () => {
  it('matches @langfuse/tracing createTraceId for Core trace ids', async () => {
    expect(await langfuseTraceId('req-003')).toBe('6ae7302035610e494029578960e35fdc')
    expect(await langfuseTraceId('gm_8f0c2a4e-1b2d-4c3e-9f5a-6b7c8d9e0f1a')).toBe(
      'f29854fad28342feb18df1f0673e6598',
    )
  })
})
