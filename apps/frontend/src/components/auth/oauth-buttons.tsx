import { useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Button } from '@/components/ui/button'
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

export function OAuthButtons() {
  const intl = useIntl()
  const { data: providers } = useOAuthProviders()
  const [pending, setPending] = useState<OAuthProviderName | null>(null)

  if (!providers || providers.length === 0) return null

  const ordered = PROVIDER_ORDER.filter((name) => providers.includes(name))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {ordered.map((name) => {
          const { label, Icon } = PROVIDER_META[name]
          return (
            <Button
              key={name}
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={() => {
                setPending(name)
                window.location.href = `${API_BASE_URL}/auth/${name}`
              }}
            >
              <Icon className="size-4" />
              {pending === name
                ? intl.formatMessage({ id: 'oauth.redirecting' })
                : intl.formatMessage({ id: 'oauth.continueWith' }, { provider: label })}
            </Button>
          )
        })}
      </div>

      <div className="flex items-center gap-3" role="separator">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">
          <FormattedMessage id="common.or" />
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}
