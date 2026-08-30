import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { ConsentBanner } from './components/layout/consent-banner.tsx'
import { AuthProvider } from './context/auth-provider.tsx'
import { LocaleProvider, applyDocumentLocale, resolveLocale } from './i18n/locale-context.tsx'
import { initTheme } from './lib/theme.ts'

initTheme()
// Before the first render, not in the provider's effect: index.html can only
// ship one literal `lang`, and an effect runs after paint, so a German UI would
// spend its first frame announcing itself as English. LocaleProvider re-applies
// this on every later change.
applyDocumentLocale(resolveLocale())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ConsentBanner />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </LocaleProvider>
  </StrictMode>,
)
