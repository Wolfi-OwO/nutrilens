// Official brand marks, kept as inline SVG rather than an icon-library
// dependency — lucide-react is a generic icon set and deliberately excludes
// third-party logos, and each of these needs its real multi-color mark
// (not a monochrome stand-in) to read as "the GitHub/Google/Microsoft
// button" at a glance per each provider's own sign-in button guidelines.

export function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.8 1.18 1.83 1.18 3.09 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.52 10.52 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  )
}

export function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M23.04 12.27c0-.82-.07-1.42-.22-2.05H12v3.72h6.32c-.13 1.03-.82 2.6-2.36 3.65l-.02.14 3.43 2.62.24.02c2.18-1.99 3.43-4.92 3.43-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23.5c3.11 0 5.72-1.01 7.62-2.75l-3.63-2.78c-.97.66-2.28 1.13-3.99 1.13-3.05 0-5.63-1.99-6.55-4.74l-.14.01-3.57 2.71-.05.13C3.65 20.98 7.5 23.5 12 23.5Z"
        fill="#34A853"
      />
      <path
        d="M5.45 14.36a6.9 6.9 0 0 1-.38-2.23c0-.78.14-1.53.37-2.23l-.01-.15-3.61-2.75-.12.06A11.47 11.47 0 0 0 .5 12.13c0 1.85.45 3.6 1.24 5.13l3.71-2.9Z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.98c2.16 0 3.62.92 4.45 1.69l3.25-3.1C17.7 1.86 15.11.75 12 .75 7.5.75 3.65 3.27 1.74 6.85l3.7 2.9c.93-2.75 3.51-4.77 6.56-4.77Z"
        fill="#EB4335"
      />
    </svg>
  )
}

export function MicrosoftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}
