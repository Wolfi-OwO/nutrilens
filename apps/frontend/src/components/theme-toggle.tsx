import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

// Compact icon toggle for the topbar. "System" is still honored at startup
// (initTheme), it just can't be re-picked from a single-press button — the
// profile screen has the full light/system/dark selector.
export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className ?? ''}`}
        >
            {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
        </button>
    );
}