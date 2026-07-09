const defaultApiUrl = 'http://localhost:3000'
const env = import.meta.env as Record<string, string | undefined>

const rawApiUrl = env['VITE_API_URL']
const rawApiKey = env['VITE_API_KEY']
const configuredApiUrl = rawApiUrl?.trim()

export const apiUrl: string =
  configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : defaultApiUrl

export const apiKey: string = rawApiKey ?? ''
