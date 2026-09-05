import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test-utils'
import { ProductForm } from './ProductForm'

describe('ProductForm', () => {
  it('create モードでは初期在庫数フィールドが表示される', () => {
    renderWithProviders(<ProductForm mode="create" onSubmit={vi.fn()} />)
    expect(screen.getByLabelText('初期在庫数')).toBeInTheDocument()
  })

  it('edit モードでは初期在庫数フィールドが表示されない', () => {
    renderWithProviders(<ProductForm mode="edit" onSubmit={vi.fn()} />)
    expect(screen.queryByLabelText('初期在庫数')).not.toBeInTheDocument()
  })

  it('initialValues がフォームに反映される', () => {
    renderWithProviders(
      <ProductForm
        mode="edit"
        initialValues={{ name: 'Product A', price: 1000, description: '説明A' }}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('商品名')).toHaveValue('Product A')
    expect(screen.getByLabelText('価格')).toHaveValue(1000)
    expect(screen.getByLabelText('説明')).toHaveValue('説明A')
  })

  it('送信すると onSubmit が入力値で呼ばれる', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<ProductForm mode="create" onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('商品名'), 'New Product')
    await user.clear(screen.getByLabelText('価格'))
    await user.type(screen.getByLabelText('価格'), '500')
    await user.type(screen.getByLabelText('説明'), '説明文')
    await user.clear(screen.getByLabelText('初期在庫数'))
    await user.type(screen.getByLabelText('初期在庫数'), '10')
    await user.click(screen.getByRole('button', { name: '保存する' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'New Product',
      price: 500,
      description: '説明文',
      count: 10,
      imageKey: null,
    })
  })

  it('isSubmitting の場合は送信ボタンが disabled になる', () => {
    renderWithProviders(<ProductForm mode="create" onSubmit={vi.fn()} isSubmitting />)
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled()
  })

  it('errorMessage が表示される', () => {
    renderWithProviders(<ProductForm mode="create" onSubmit={vi.fn()} errorMessage="失敗しました" />)
    expect(screen.getByText('失敗しました')).toBeInTheDocument()
  })
})
