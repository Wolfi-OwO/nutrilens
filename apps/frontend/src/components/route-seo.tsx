import { useEffect } from 'react';
import { useLocation } from 'react-router';

const ORIGIN = 'https://nutrilens.woofi-developments.at';
// The routes outside <ProtectedRoute /> that are real content (the same list as public/sitemap.xml). Everything
// else is the app itself, a sign-in page or the dashboard, and says noindex: a robots.txt Disallow alone never
// removes a URL from the index, because the crawler cannot see a noindex on a page it may not fetch.
const PUBLIC = new Set(['/about', '/impressum', '/datenschutz', '/agb', '/datenquellen']);

/**
 * index.html is served for every path, so without this each route inherits one shared head. It gives public pages
 * their own canonical (not a duplicate of "/") and marks the rest noindex.
 */
export function RouteSeo(): null {
    const { pathname } = useLocation();
    useEffect(() => {
        const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
        document.querySelector('link[rel="canonical"]')?.remove();
        document.querySelector('meta[name="robots"][data-route-seo]')?.remove();
        if (PUBLIC.has(path)) {
            const link = document.createElement('link');
            link.rel = 'canonical';
            link.href = `${ORIGIN}${path}`;
            document.head.appendChild(link);
        } else {
            const meta = document.createElement('meta');
            meta.name = 'robots';
            meta.content = 'noindex, nofollow';
            meta.dataset.routeSeo = '';
            document.head.appendChild(meta);
        }
    }, [pathname]);
    return null;
}
