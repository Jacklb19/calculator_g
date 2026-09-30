import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from './api/ApiError'
import type { ApiClient } from './api/client'
import type { CalculationResult, Operation } from './api/types'
import { App } from './App'

const arithmetic: Record<Operation, (a: number, b: number) => number> = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
  multiply: (a, b) => a * b,
  divide: (a, b) => a / b,
  power: (a, b) => a ** b,
  sqrt: (a) => Math.sqrt(a),
  percentage: (a, b) => (a * b) / 100,
}

function fakeApi(
  implementation: ApiClient['calculate'] = async (operation, operands) => ({
    operation,
    operands,
    result: arithmetic[operation](operands[0], operands[1]),
  }),
) {
  const calculate = vi.fn<ApiClient['calculate']>(implementation)
  return { api: { calculate }, calculate }
}

function renderApp(api: ApiClient = fakeApi().api) {
  const user = userEvent.setup()
  render(<App api={api} />)
  return { user }
}

function displayValue() {
  return screen.getByRole('status').textContent
}

function key(name: string) {
  return within(screen.getByRole('group', { name: 'Keypad' })).getByRole('button', { name })
}

async function clickKeys(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  for (const name of names) await user.click(key(name))
}

describe('App', () => {
  it('starts at zero with no error', () => {
    renderApp()

    expect(displayValue()).toBe('0')
    expect(screen.getByRole('alert')).toBeEmptyDOMElement()
  })

  it('shows digits as they are typed', async () => {
    const { user } = renderApp()

    await clickKeys(user, '1', '2', 'Decimal point', '5')

    expect(displayValue()).toBe('12.5')
  })

  it('shows the pending expression', async () => {
    const { user } = renderApp()

    await clickKeys(user, '1', '2', 'Add')

    expect(screen.getByText('12 +')).toBeInTheDocument()
  })

  it('calculates through the api and shows the result', async () => {
    const { api, calculate } = fakeApi()
    const { user } = renderApp(api)

    await clickKeys(user, '2', 'Add', '3', 'Equals')

    await waitFor(() => expect(displayValue()).toBe('5'))
    expect(calculate).toHaveBeenCalledWith('add', [2, 3], expect.anything())
    expect(screen.queryByText('2 +')).not.toBeInTheDocument()
  })

  it('formats results to 15 significant digits', async () => {
    const { user } = renderApp()

    await clickKeys(user, '1', 'Divide', '3', 'Equals')

    await waitFor(() => expect(displayValue()).toBe('0.333333333333333'))
  })

  it('applies square root immediately', async () => {
    const { user } = renderApp()

    await clickKeys(user, '8', '1', 'Square root')

    await waitFor(() => expect(displayValue()).toBe('9'))
  })

  it('marks only the pending operator as pressed', async () => {
    const { user } = renderApp()

    await clickKeys(user, '6', 'Multiply')

    expect(key('Multiply')).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['Add', 'Subtract', 'Divide', 'Power', 'Percent of']) {
      expect(key(name)).toHaveAttribute('aria-pressed', 'false')
    }
    expect(key('7')).not.toHaveAttribute('aria-pressed')
  })

  it('releases the operator once the result is shown', async () => {
    const { user } = renderApp()

    await clickKeys(user, '6', 'Multiply', '7', 'Equals')

    await waitFor(() => expect(displayValue()).toBe('42'))
    expect(key('Multiply')).toHaveAttribute('aria-pressed', 'false')
  })

  describe('keyboard', () => {
    it('types numbers and calculates on Enter', async () => {
      const { user } = renderApp()

      await user.keyboard('12*3{Enter}')

      await waitFor(() => expect(displayValue()).toBe('36'))
    })

    it('supports backspace and escape', async () => {
      const { user } = renderApp()

      await user.keyboard('123{Backspace}')
      expect(displayValue()).toBe('12')

      await user.keyboard('+4{Escape}')
      expect(displayValue()).toBe('0')
      expect(screen.queryByText('12 +')).not.toBeInTheDocument()
    })

    it('does not also click the focused button on Enter', async () => {
      const { user } = renderApp()

      await clickKeys(user, '7')
      expect(key('7')).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(displayValue()).toBe('7')
    })

    it('leaves shortcuts with modifier keys to the browser', async () => {
      const { api, calculate } = fakeApi()
      const { user } = renderApp(api)

      await user.keyboard('9{Control>}r{/Control}')
      fireEvent.keyDown(window, { key: 'r', ctrlKey: true, altKey: true })

      expect(calculate).not.toHaveBeenCalled()
    })

    it('accepts characters typed with AltGr, which Windows reports as Ctrl+Alt', async () => {
      const { user } = renderApp()

      await user.keyboard('81')
      fireEvent.keyDown(window, { key: '@', ctrlKey: true, altKey: true, modifierAltGraph: true })

      await waitFor(() => expect(displayValue()).toBe('9'))
    })
  })

  describe('while loading', () => {
    it('marks the keypad unavailable without making it unfocusable, and ignores input', async () => {
      let resolve!: (result: CalculationResult) => void
      const { api } = fakeApi(() => new Promise((res) => (resolve = res)))
      const { user } = renderApp(api)

      await clickKeys(user, '2', 'Add', '3', 'Equals')

      expect(screen.getByRole('region', { name: 'Calculator' })).toHaveAttribute('aria-busy', 'true')
      for (const button of screen.getAllByRole('button')) {
        expect(button).toHaveAttribute('aria-disabled', 'true')
        expect(button).toBeEnabled()
      }
      expect(key('Equals')).toHaveFocus()
      await user.keyboard('9')
      await user.click(key('9'))
      expect(displayValue()).toBe('3')

      resolve({ operation: 'add', operands: [2, 3], result: 5 })
      await waitFor(() => expect(key('9')).toHaveAttribute('aria-disabled', 'false'))
      expect(displayValue()).toBe('5')
    })
  })

  describe('errors', () => {
    it('shows a friendly message and keeps the input', async () => {
      const { api } = fakeApi(() =>
        Promise.reject(new ApiError('DIVISION_BY_ZERO', 'division by zero', 422)),
      )
      const { user } = renderApp(api)

      await clickKeys(user, '1', 'Divide', '0', 'Equals')

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent("Can't divide by zero."))
      expect(displayValue()).toBe('0')
      expect(screen.getByText('1 ÷')).toBeInTheDocument()
    })

    it('clears the message on the next key and allows a retry', async () => {
      const { api, calculate } = fakeApi()
      calculate.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'The server could not be reached'))
      const { user } = renderApp(api)

      await clickKeys(user, '2', 'Add', '3', 'Equals')
      await waitFor(() => expect(screen.getByRole('alert')).not.toBeEmptyDOMElement())

      await clickKeys(user, 'Equals')

      await waitFor(() => expect(displayValue()).toBe('5'))
      expect(screen.getByRole('alert')).toBeEmptyDOMElement()
    })
  })
})
