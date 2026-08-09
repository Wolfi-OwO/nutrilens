// Dark-mode CSS variables already exist in index.css (`.dark { ... }`), but
// nothing ever applied the class — dark mode was unreachable regardless of
// the user's OS preference. System-only for now (no manual toggle UI yet);
// mirrors the theme detection portfolio-webpage's DefaultLayout does, minus
// the localStorage override this app doesn't have a settings surface for.
export function initTheme(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    document.documentElement.classList.toggle('dark', media.matches)
  }
  apply()
  media.addEventListener('change', apply)
}
