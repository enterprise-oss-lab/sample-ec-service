import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { FlashProvider, useFlash } from './context'

function TestFlash({ label = 'テストメッセージ' }: { label?: string }) {
  const { messages, flash, dismiss } = useFlash()
  return (
    <div>
      {messages.map((m) => (
        <p key={m.id} data-testid="flash-message">
          {m.message}
        </p>
      ))}
      <button onClick={() => flash(label)}>flash</button>
      <button onClick={() => messages[0] && dismiss(messages[0].id)}>dismiss</button>
    </div>
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('FlashProvider', () => {
  it('flash() でメッセージが追加される', () => {
    render(
      <FlashProvider>
        <TestFlash />
      </FlashProvider>,
    )
    fireEvent.click(screen.getByText('flash'))
    expect(screen.getByTestId('flash-message')).toHaveTextContent('テストメッセージ')
  })

  it('dismiss() でメッセージが削除される', () => {
    render(
      <FlashProvider>
        <TestFlash />
      </FlashProvider>,
    )
    fireEvent.click(screen.getByText('flash'))
    expect(screen.getByTestId('flash-message')).toBeInTheDocument()
    fireEvent.click(screen.getByText('dismiss'))
    expect(screen.queryByTestId('flash-message')).not.toBeInTheDocument()
  })

  it('3500ms 後に自動削除される', () => {
    vi.useFakeTimers()
    render(
      <FlashProvider>
        <TestFlash />
      </FlashProvider>,
    )
    fireEvent.click(screen.getByText('flash'))
    expect(screen.getByTestId('flash-message')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3500) })
    expect(screen.queryByTestId('flash-message')).not.toBeInTheDocument()
  })

  it('FlashProvider 外で useFlash() を呼ぶと throw する', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => render(<TestFlash />)).toThrow(
      'useFlash must be used within FlashProvider',
    )
    spy.mockRestore()
  })
})
