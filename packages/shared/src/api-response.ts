/**
 * Standard API response envelope used by all non-streaming endpoints.
 *
 * Successful responses: data is set, error is null.
 * Failed responses:     data is null, error is set.
 */
export type ApiResponse<T> =
  | {
      data: T
      error: null
      meta?: ResponseMeta
    }
  | {
      data: null
      error: ApiError
      meta?: ResponseMeta
    }

export type ApiError = {
  code: ErrorCode
  message: string
  details?: unknown
}

export type ResponseMeta = {
  requestId?: string
  timestamp?: string
}

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'

/** Convenience: build a successful ApiResponse */
export function ok<T>(data: T, meta?: ResponseMeta): ApiResponse<T> {
  return { data, error: null, ...(meta !== undefined ? { meta } : {}) }
}

/** Convenience: build a failed ApiResponse */
export function fail<T = null>(
  code: ErrorCode,
  message: string,
  details?: unknown,
  meta?: ResponseMeta,
): ApiResponse<T> {
  return {
    data: null,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    ...(meta !== undefined ? { meta } : {}),
  }
}
