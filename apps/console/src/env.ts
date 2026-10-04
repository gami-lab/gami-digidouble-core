const defaultApiUrl = 'http://localhost:3000'

const rawApiUrl: string | undefined = import.meta.env.VITE_API_URL
const rawApiKey: string | undefined = import.meta.env.VITE_API_KEY
const rawLangfuseProjectUrl: string | undefined = import.meta.env.VITE_LANGFUSE_PROJECT_URL
const configuredApiUrl = rawApiUrl?.trim()

export const apiUrl: string =
  configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : defaultApiUrl

export const apiKey: string = rawApiKey ?? ''

/** e.g. https://cloud.langfuse.com/project/<projectId>; trace links are hidden when unset. */
export const langfuseProjectUrl: string | null =
  rawLangfuseProjectUrl !== undefined && rawLangfuseProjectUrl.trim().length > 0
    ? rawLangfuseProjectUrl.trim().replace(/\/$/, '')
    : null
