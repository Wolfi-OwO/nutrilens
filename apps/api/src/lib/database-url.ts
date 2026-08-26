/**
 * Hosts that are never reachable over TLS in this project: the loopback
 * names, plus any bare hostname (no dot) — a Docker Compose service name
 * like `postgres`, which is what both docker-compose.yml files and the
 * local `.env.example` point at. Every real remote target (Azure's
 * `*.postgres.database.azure.com`) is a dotted FQDN.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function isLocalHost(host: string): boolean {
    return LOOPBACK_HOSTS.has(host) || !host.includes('.');
}

/**
 * Pins `sslmode=verify-full` on connection strings pointing at a remote
 * database, leaving local/compose/CI targets untouched.
 *
 * Production currently gets verify-full by accident: pg 8 treats 'prefer',
 * 'require' and 'verify-ca' as aliases for it, and says so at startup —
 * "SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are
 * treated as aliases for 'verify-full'" (production logs, 2026-08-25). In
 * pg 9 / pg-connection-string 3 those modes adopt libpq semantics, which
 * verify the server certificate less strictly or not at all. That downgrade
 * would arrive on a routine dependency bump with no error and no log line,
 * so the mode is pinned here rather than left to whatever DATABASE_URL the
 * environment happens to carry — the production value is an Azure
 * environment variable this repo cannot set.
 *
 * Local Postgres is plaintext on an internal Docker network with no TLS at
 * all, so forcing verify-full there would break every local run and the
 * whole test suite.
 *
 * @param connectionString - A PostgreSQL connection URI.
 * @returns The URI with `sslmode=verify-full` for remote hosts; the input
 *   unchanged for local hosts, or if it isn't a parseable URI.
 */
export function pinVerifyFullSsl(connectionString: string): string {
    let url: URL;
    try {
        url = new URL(connectionString);
    } catch {
        // Not a URI (pg also accepts key=value DSNs). Nothing to rewrite;
        // let pg report its own error rather than swallowing the value here.
        return connectionString;
    }

    if (isLocalHost(url.hostname)) {
        return connectionString;
    }

    if (url.searchParams.get('sslmode') === 'verify-full') {
        return connectionString;
    }

    url.searchParams.set('sslmode', 'verify-full');
    return url.toString();
}
