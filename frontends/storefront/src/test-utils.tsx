import { type ReactNode } from 'react'
import { render, type RenderOptions, renderHook, type RenderHookOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { FlashProvider, Flash } from '@/shared/Flash'

function createWrapper(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <FlashProvider>
          <Flash />
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </FlashProvider>
      </QueryClientProvider>
    )
  }
}

// initialEntries は URL パラメータを取るページ (例 /products/:id) のテスト用。
// Router は入れ子にできないため、ここで初期 URL を渡す必要がある。
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialEntries?: string[] },
) {
  const { initialEntries, ...renderOptions } = options ?? {}
  return render(ui, { wrapper: createWrapper(initialEntries), ...renderOptions })
}

export function renderHookWithProviders<T>(
  hook: () => T,
  options?: Omit<RenderHookOptions<unknown>, 'wrapper'>,
) {
  return renderHook(hook, { wrapper: createWrapper(), ...options })
}

export * from '@testing-library/react'
