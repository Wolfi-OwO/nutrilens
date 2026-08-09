import { Route, Routes } from 'react-router'
import { AppLayout } from '@/components/layout/app-layout'
import { ProtectedRoute } from '@/components/protected-route'
import LoginPage from '@/pages/login'
import RegisterPage from '@/pages/register'
import DashboardPage from '@/pages/dashboard'
import LogMealPage from '@/pages/log-meal'
import PlanPage from '@/pages/plan'
import ProgressPage from '@/pages/progress'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/log-meal" element={<LogMealPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
