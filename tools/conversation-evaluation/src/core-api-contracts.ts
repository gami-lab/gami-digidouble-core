import type { AdminSessionEventsResponse } from '@gami/shared'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isAdminSessionEventsResponse(value: unknown): value is AdminSessionEventsResponse {
  return (
    isRecord(value) &&
    Array.isArray(value['events']) &&
    value['events'].every((event) => {
      if (!isRecord(event)) return false
      return (
        isString(event['type']) &&
        isString(event['correlationId']) &&
        isString(event['createdAt']) &&
        isRecord(event['payload'])
      )
    })
  )
}
