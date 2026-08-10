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

// Same three-zone shape as network-visualizer's and portfolio-webpage's
// footers (copyright | version chip | links), same glass/blur/border-top
// treatment — but in-flow rather than pinned to the viewport bottom like
// those two. Pinning it there would need the same h-dvh + flex-col +
// internal-scroll page shell those apps use, which this app doesn't have
// (its pages scroll normally), and on mobile the bottom tab nav already
// owns that fixed strip — a second fixed bar would collide with it. This
// renders at the end of each page's content instead, everywhere.
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
    <footer className="mt-10 flex flex-col items-center gap-3 rounded-xl border-t border-border bg-card/60 px-4 py-5 text-xs text-muted-foreground backdrop-blur-sm sm:flex-row sm:justify-between sm:px-6">
      <span>&copy; {new Date().getFullYear()} nutrilens. All rights reserved.</span>

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

      {buildInfo.repositoryUrl && (
        <nav className="flex items-center gap-4 font-medium">
          <a
            href={buildInfo.repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            About
          </a>
        </nav>
      )}
    </footer>
  )
}
