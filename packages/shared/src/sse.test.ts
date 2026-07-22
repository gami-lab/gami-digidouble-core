import { describe, expect, it } from 'vitest'
import { parseSseDataFrame, processSseFrames } from './sse.js'

describe('SSE frame helpers', () => {
  it('parses one JSON data frame and ignores comments or malformed data', () => {
    expect(parseSseDataFrame('event: runtime_event\ndata: {"eventId":"e1"}')).toEqual({
      eventId: 'e1',
    })
    expect(parseSseDataFrame(': keepalive\n\n')).toBeNull()
    expect(parseSseDataFrame('data: not-json')).toBeNull()
  })

  it('returns an incomplete remainder while dispatching complete frames', () => {
    const events: unknown[] = []
    const remainder = processSseFrames(
      'data: {"eventId":"e1"}\n\n:data keepalive\n\ndata: {"eventId":"e2"}',
      (event) => events.push(event),
    )

    expect(events).toEqual([{ eventId: 'e1' }])
    expect(remainder).toBe('data: {"eventId":"e2"}')
  })
})
