import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from './App'

describe('App inspector navigation', () => {
  it('exposes unified testing navigation path', () => {
    const html = renderToStaticMarkup(<App />)

    expect(html).toContain('Scenario')
    expect(html).toContain('Unified Session Runner')
  })
})
