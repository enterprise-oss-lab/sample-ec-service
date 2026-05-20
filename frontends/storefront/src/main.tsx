import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { HomePage } from './pages/Home/index.tsx'
import { OrderPage } from './pages/Order/index.tsx'
import { Header } from './shared/Header/index.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/orders" element={<OrderPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
