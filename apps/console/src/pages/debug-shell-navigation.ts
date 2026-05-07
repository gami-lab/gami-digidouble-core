import type { InspectorTab } from '../components/runtime-inspector-tab-content'

export type DebugShellSection =
  | 'session-setup'
  | 'memory'
  | 'gm-impact'
  | 'turn-profiler'
  | 'persona'

export const DEBUG_SHELL_SECTIONS: Array<{ id: DebugShellSection; label: string }> = [
  { id: 'session-setup', label: 'Session Setup' },
  { id: 'memory', label: 'Memory' },
  { id: 'gm-impact', label: 'GM Impact' },
  { id: 'turn-profiler', label: 'Turn Profiler' },
  { id: 'persona', label: 'Persona' },
]

export type DebugShellContext = {
  scenarioId: string
  sessionId: string | null
  section: DebugShellSection
}

export function createDebugShellContext(scenarioId: string): DebugShellContext {
  return {
    scenarioId,
    sessionId: null,
    section: 'session-setup',
  }
}

export function withDebugShellSection(
  context: DebugShellContext,
  section: DebugShellSection,
): DebugShellContext {
  return {
    ...context,
    section,
  }
}

export function withDebugShellSession(
  context: DebugShellContext,
  sessionId: string | null,
): DebugShellContext {
  return {
    ...context,
    sessionId,
  }
}

export function sectionRuntimeInspectorTab(section: DebugShellSection): InspectorTab | null {
  if (section === 'memory') return 'memory'
  if (section === 'gm-impact') return 'events'
  if (section === 'turn-profiler') return 'metrics'
  if (section === 'persona') return 'persona'
  return null
}
