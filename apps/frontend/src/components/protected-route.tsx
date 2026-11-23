import { Navigate, Outlet, useLocation } from 'react-router';
import { lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';

// The one route an anonymous visitor may open without signing in: the front door, so "/" can be found in search.
const LandingPage = lazy(() => import('@/pages/landing'));

export function ProtectedRoute() {
    const { user, isLoading } = useAuth();
    const { pathname } = useLocation();

    if (isLoading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
        );
    }

    if (!user) {
        if (pathname === '/') {
            return (
                <Suspense fallback={null}>
                    <LandingPage />
                </Suspense>
            );
        }
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}
