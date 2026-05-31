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
import { HomePage } from './pages/Home/index.tsx'
import { OrderPage } from './pages/Order/index.tsx'
import { AccountPage } from './pages/Account/index.tsx'
import { CartPage } from './pages/Cart/index.tsx'
import { Header } from './shared/Header/index.tsx'
import { Flash, FlashProvider } from './shared/Flash/index.tsx'
import './index.css'
import { ProductPage } from './pages/Product/index.tsx'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FlashProvider>
        <BrowserRouter>
          <Header />
          <Flash />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductPage />} />
            <Route path="/orders" element={<OrderPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/cart" element={<CartPage />} />
          </Routes>
        </BrowserRouter>
      </FlashProvider>
    </QueryClientProvider>
  </StrictMode>,
)
