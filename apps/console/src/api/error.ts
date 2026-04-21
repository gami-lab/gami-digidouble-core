import { ApiError } from './client'

export const formatApiError = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof ApiError) {
    return `${error.code}: ${error.message}`
  }

  return fallbackMessage
}
