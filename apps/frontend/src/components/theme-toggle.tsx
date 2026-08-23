import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';

// Light -> dark -> system -> light. Three-state cycle keeps this a single
// button instead of needing a menu, and gives a way back to "system" that
// the previous two-state light/dark toggle had no path to.
const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };

export function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme } = useTheme();
    // `theme === 'dark'` alone ignored the resolved OS value: on system+dark
    // it showed the wrong icon and a click landed on 'dark' with no visible
    // change (already dark via the OS). Resolve system through matchMedia,
    // same source lib/theme.ts uses to decide the document class.
    const isDark = theme === 'dark'
        || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const systemIndicator = theme === 'system'
        ? (
            <span className="absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-background ring-1 ring-border">
                <Monitor size={8} strokeWidth={2.5} className="text-muted-foreground" />
            </span>
        )
        : null;

    const label = theme === 'system'
        ? 'Following system theme — switch to light mode'
        : isDark
            ? 'Switch to light mode'
            : 'Switch to dark mode';

    return (
        <button
            type="button"
            onClick={() => setTheme(NEXT[theme])}
            aria-label={label}
            className={`relative flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ''}`}
        >
            {systemIndicator}
            {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
        </button>
    );
}
