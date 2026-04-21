const defaultApiUrl = 'http://localhost:3000'

const rawApiUrl: string | undefined = import.meta.env.VITE_API_URL
const rawApiKey: string | undefined = import.meta.env.VITE_API_KEY
const configuredApiUrl = rawApiUrl?.trim()

export const apiUrl: string =
  configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : defaultApiUrl

export const apiKey: string = rawApiKey ?? ''
