import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router';
import { AdminRoute } from '@/components/admin-route';
import { AdminLayout } from '@/components/layout/admin-layout';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/protected-route';

const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const OAuthCallbackPage = lazy(() => import('@/pages/oauth-callback'));
const DashboardPage = lazy(() => import('@/pages/dashboard'));
const LogMealPage = lazy(() => import('@/pages/log-meal'));
const PlanPage = lazy(() => import('@/pages/plan'));
const ProgressPage = lazy(() => import('@/pages/progress'));
const ProfilePage = lazy(() => import('@/pages/profile'));
const AdminOverviewPage = lazy(() => import('@/pages/admin/overview'));
const AdminUsersPage = lazy(() => import('@/pages/admin/users'));
const AdminAuditLogPage = lazy(() => import('@/pages/admin/audit-log'));

function PageFallback() {
    return (
        <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
    );
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
                        <Route path="/profile" element={<ProfilePage />} />
                    </Route>

                    <Route element={<AdminRoute />}>
                        <Route element={<AdminLayout />}>
                            <Route path="/admin" element={<AdminOverviewPage />} />
                            <Route path="/admin/users" element={<AdminUsersPage />} />
                            {/* Not /admin/audit-log — that's the real GET /admin/audit-log
                  API route (adminRouter), mounted before mountFrontend's SPA
                  fallback in app.ts. A full-page navigation to a path
                  matching a backend route hits the API handler directly
                  (raw JSON, no auth header on a plain browser nav → 401),
                  never the SPA — caught by e2e/tests/admin.spec.ts doing a
                  real page.goto(), which a client-side <Link> never would. */}
                            <Route path="/admin/audit" element={<AdminAuditLogPage />} />
                        </Route>
                    </Route>
                </Route>
            </Routes>
        </Suspense>
    );
}

export default App;
