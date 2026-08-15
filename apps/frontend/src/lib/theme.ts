// Dark-mode CSS variables live in index.css (`.dark { ... }`); this module
// decides whether the class is applied. The user's explicit choice, if any,
// wins over the OS preference, and it is persisted so the choice survives
// reloads (previously dark mode was unreachable — the class was never set).
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'nutrilens.theme'
export type Theme = 'light' | 'dark' | 'system'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

export function initTheme(): void {
  const stored = localStorage.getItem(STORAGE_KEY)
  const theme: Theme = stored === 'light' || stored === 'dark' ? stored : 'system'
  applyTheme(theme)
  // Follow live OS changes only when the user hasn't pinned a theme.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem(STORAGE_KEY) === 'system') applyTheme('system')
  })
}

// The stored value only ever records an explicit override; an empty storage
// slot means "system". Reading it back this way keeps the selector honest
// about which source actually won.
export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme())

  const setTheme = (next: Theme) => {
    if (next === 'system') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, next)
    }
    setThemeState(next)
    applyTheme(next)
  }

  // Re-sync when the OS preference flips while the user is on "system".
  useEffect(() => {
    if (getStoredTheme() !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return { theme, setTheme }
}
