const defaultApiUrl = 'http://localhost:3000'
const env = import.meta.env as Record<string, string | undefined>

const configuredApiUrl = env['VITE_API_URL']?.trim()

export const apiUrl: string =
  configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : defaultApiUrl
