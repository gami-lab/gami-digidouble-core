// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODEL_SELECTION_PROVIDER_NAMES } from '@gami/shared'
import { ModelSelectionTable } from './ModelSelectionTable'

afterEach(() => {
  cleanup()
})

function renderTable(onChange = vi.fn()): typeof onChange {
  render(
    <ModelSelectionTable
      providers={MODEL_SELECTION_PROVIDER_NAMES}
      rows={[{ id: 'row', label: 'Avatar', value: { provider: 'openai', model: 'gpt-5.6-luna' } }]}
      onChange={onChange}
    />,
  )
  return onChange
}

describe('ModelSelectionTable', () => {
  it('clears the model when the new provider does not support it', () => {
    const onChange = renderTable()

    fireEvent.change(screen.getByLabelText('Avatar provider'), { target: { value: 'mistral' } })

    expect(onChange).toHaveBeenCalledWith('row', { provider: 'mistral', model: '' })
  })

  it('resets a row to inherit', () => {
    const onChange = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }))

    expect(onChange).toHaveBeenCalledWith('row', { provider: '', model: '' })
  })
})
