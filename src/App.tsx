import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import AppShell from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import ARPage from './pages/ARPage'
import APPage from './pages/APPage'
import ExpensesPage from './pages/ExpensesPage'
import TaxPage from './pages/TaxPage'
import BankPage from './pages/BankPage'
import SettingsPage from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/ar" element={<ARPage />} />
            <Route path="/ap" element={<APPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/tax" element={<TaxPage />} />
            <Route path="/bank" element={<BankPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A2B45',
            color: '#FAF8F3',
            border: '1px solid rgba(212, 175, 55, 0.3)',
          },
        }}
      />
    </QueryClientProvider>
  )
}
