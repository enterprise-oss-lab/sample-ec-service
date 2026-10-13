import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { authenticateForTest, renderWithProviders } from '@/test-utils'
import { Header } from '.'

describe('Header', () => {
  it('未ログイン時は注文履歴タブを表示しない', () => {
    renderWithProviders(<Header />)

    expect(screen.queryByText('注文履歴')).not.toBeInTheDocument()
  })

  it('ログイン時は注文履歴タブを表示する', () => {
    authenticateForTest()
    renderWithProviders(<Header />)

    expect(screen.getAllByText('注文履歴')).toHaveLength(2)
  })
})
