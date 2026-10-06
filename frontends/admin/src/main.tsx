import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

if (import.meta.env.VITE_MSW_ENABLED === 'true') {
  try {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  } catch {
    // Service workers not available (e.g., blocked in test environment)
  }
}
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './shared/Layout/index.tsx'
import { FlashProvider } from './shared/Flash/index.tsx'
import { InventoryListPage } from './pages/InventoryList/index.tsx'
import { ProductNewPage } from './pages/ProductNew/index.tsx'
import { ProductEditPage } from './pages/ProductEdit/index.tsx'
import './index.css'
import { AuthProvider, RequireAdmin } from './auth/context.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                element={
                  <RequireAdmin>
                    <Layout />
                  </RequireAdmin>
                }
              >
                <Route path="/" element={<InventoryListPage />} />
                <Route path="/products/new" element={<ProductNewPage />} />
                <Route
                  path="/products/:id/edit"
                  element={<ProductEditPage />}
                />
              </Route>
              <Route
                path="/auth/callback"
                element={<p className="p-8">ログイン中...</p>}
              />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </FlashProvider>
    </QueryClientProvider>
  </StrictMode>,
)
