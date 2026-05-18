import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScenarioSessionLauncher } from './ScenarioSessionLauncher'

describe('ScenarioSessionLauncher', () => {
  it('disables start button when persona-first gate blocks start', () => {
    const html = renderToStaticMarkup(
      <ScenarioSessionLauncher
        userId="tester"
        session={null}
        isStarting={false}
        canStart={false}
        startBlockedReason="Save persona first"
        onUserIdChange={vi.fn()}
        onStart={vi.fn()}
      />,
    )

    expect(html).toContain('Run and investigate session')
    expect(html).toContain('disabled')
    expect(html).toContain('Save persona first')
  })
})
