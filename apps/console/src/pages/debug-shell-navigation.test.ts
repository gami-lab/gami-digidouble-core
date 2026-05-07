import { describe, expect, it } from 'vitest'
import {
  createDebugShellContext,
  sectionRuntimeInspectorTab,
  withDebugShellSection,
  withDebugShellSession,
} from './debug-shell-navigation'

describe('debug-shell-navigation', () => {
  it('maps top-level sections to runtime inspector tabs', () => {
    expect(sectionRuntimeInspectorTab('session-setup')).toBeNull()
    expect(sectionRuntimeInspectorTab('memory')).toBe('memory')
    expect(sectionRuntimeInspectorTab('gm-impact')).toBe('events')
    expect(sectionRuntimeInspectorTab('turn-profiler')).toBe('metrics')
    expect(sectionRuntimeInspectorTab('persona')).toBe('persona')
  })

  it('preserves scenario and session context when switching sections', () => {
    const initial = createDebugShellContext('scenario_1')
    const withSession = withDebugShellSession(initial, 'session_1')
    const next = withDebugShellSection(withSession, 'gm-impact')

    expect(next.scenarioId).toBe('scenario_1')
    expect(next.sessionId).toBe('session_1')
    expect(next.section).toBe('gm-impact')
  })
})
