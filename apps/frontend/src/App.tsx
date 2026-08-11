import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/components/protected-route'

const LoginPage = lazy(() => import('@/pages/login'))
const RegisterPage = lazy(() => import('@/pages/register'))
const OAuthCallbackPage = lazy(() => import('@/pages/oauth-callback'))
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const LogMealPage = lazy(() => import('@/pages/log-meal'))
const PlanPage = lazy(() => import('@/pages/plan'))
const ProgressPage = lazy(() => import('@/pages/progress'))

function PageFallback() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Not /auth/callback — collides with the backend's own
            GET /auth/:provider route (oauthRouter), matching "callback" as
            :provider. See the matching comment in oauth.handlers.ts and the
            one above mountFrontend(app) in apps/api/src/app.ts. */}
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/log-meal" element={<LogMealPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/progress" element={<ProgressPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
