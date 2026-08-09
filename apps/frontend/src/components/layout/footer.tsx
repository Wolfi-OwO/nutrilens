import { Code2 } from 'lucide-react'
import { useBuildInfo } from '@/hooks/use-build-info'

function repoSlug(url: string): string {
  if (!url) return ''
  try {
    return new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '')
  } catch {
    return ''
  }
}

// In-flow, not a fixed/anchored bar — the mobile bottom tab nav in
// AppLayout already owns that space (a fixed footer would collide with
// it), so this renders at the end of each page's scrollable content instead.
export function Footer() {
  const { data: buildInfo } = useBuildInfo()
  if (!buildInfo) return null

  const slug = repoSlug(buildInfo.repositoryUrl)
  const label = slug || 'local'
  const tooltip = [
    buildInfo.revision && `revision ${buildInfo.revision}`,
    buildInfo.buildDate && `built ${buildInfo.buildDate}`,
  ]
    .filter(Boolean)
    .join(' · ')

  const chip = (
    <span
      title={tooltip || undefined}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 font-mono text-xs text-muted-foreground"
    >
      <Code2 size={13} strokeWidth={2} className="text-muted-foreground" />
      <span className="text-foreground">{label}</span>
      <span className="text-border">·</span>
      <span>{buildInfo.version}</span>
    </span>
  )

  return (
    <footer className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between">
      <span>&copy; {new Date().getFullYear()} nutrilens</span>
      {buildInfo.repositoryUrl ? (
        <a
          href={buildInfo.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity hover:opacity-80"
        >
          {chip}
        </a>
      ) : (
        chip
      )}
    </footer>
  )
}
