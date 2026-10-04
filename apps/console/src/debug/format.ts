export function formatMs(ms: number | undefined | null): string {
  if (ms === undefined || ms === null) return '—'
  if (ms < 1000) return `${String(Math.round(ms))} ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
}

export function formatTokens(input: number | undefined, output: number | undefined): string {
  if (input === undefined && output === undefined) return '—'
  return `${String(input ?? 0)} in · ${String(output ?? 0)} out`
}

export function shortId(id: string): string {
  const separator = id.lastIndexOf('_')
  const body = separator >= 0 ? id.slice(separator + 1) : id
  return body.slice(0, 8)
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
