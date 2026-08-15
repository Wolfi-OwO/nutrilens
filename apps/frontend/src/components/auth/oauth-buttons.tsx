import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { API_BASE_URL } from '@/lib/api-client'
import { useOAuthProviders } from '@/hooks/use-oauth-providers'
import { GitHubIcon, GoogleIcon, MicrosoftIcon } from '@/components/auth/provider-icons'
import type { OAuthProviderName } from '@/types/api'

const PROVIDER_META: Record<OAuthProviderName, { label: string; Icon: typeof GitHubIcon }> = {
  github: { label: 'GitHub', Icon: GitHubIcon },
  google: { label: 'Google', Icon: GoogleIcon },
  microsoft: { label: 'Microsoft', Icon: MicrosoftIcon },
}

// Deterministic display order, independent of whatever order the API
// happens to return — alphabetical so it never looks like a ranking.
const PROVIDER_ORDER: OAuthProviderName[] = ['github', 'google', 'microsoft']

// The one shared piece of both the skeleton and the real block, so the two
// can't drift out of alignment: same h-11 rows, same 8px gaps, same rule.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">{children}</div>
      <div className="flex items-center gap-3" role="separator">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

export function OAuthButtons() {
  const { isPending, data: providers } = useOAuthProviders()
  const [pending, setPending] = useState<OAuthProviderName | null>(null)

  // This block sits directly above the email/password form. Rendering null
  // while /auth/providers was in flight and then three 44px buttons plus a
  // rule meant the whole form jumped ~170px down a moment after the page
  // painted — the worst layout shift in the app, and on the first screen a
  // new user ever sees. Reserve the space with a skeleton of the same shape.
  // Three rows because that is the maximum the API can return; a deployment
  // with fewer configured settles up, which is a far smaller shift than
  // settling down from nothing, and one with none at all is a dev-only case.
  if (isPending) {
    return (
      <Shell>
        {PROVIDER_ORDER.map((name) => (
          <Skeleton key={name} className="h-11 w-full rounded-md" />
        ))}
      </Shell>
    )
  }

  if (!providers || providers.length === 0) return null

  const ordered = PROVIDER_ORDER.filter((name) => providers.includes(name))

  return (
    <Shell>
      {ordered.map((name) => {
        const { label, Icon } = PROVIDER_META[name]
        return (
          <Button
            key={name}
            type="button"
            variant="outline"
            loading={pending === name}
            disabled={pending !== null}
            onClick={() => {
              setPending(name)
              window.location.href = `${API_BASE_URL}/auth/${name}`
            }}
          >
            {pending !== name && <Icon className="size-4" />}
            {pending === name ? 'Redirecting…' : `Continue with ${label}`}
          </Button>
        )
      })}
    </Shell>
  )
}
