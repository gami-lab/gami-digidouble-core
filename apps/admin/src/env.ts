const defaultApiUrl = 'http://localhost:3000'

// Read the one variable by name: Vite inlines only what is referenced, never the whole env.
const configuredApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim()

export const apiUrl: string =
  configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : defaultApiUrl
