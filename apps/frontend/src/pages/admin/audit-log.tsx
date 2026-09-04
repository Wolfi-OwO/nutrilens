import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardList } from 'lucide-react';
import { FormattedDate, FormattedMessage, FormattedTime, useIntl } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAdminAuditLog } from '@/hooks/use-admin-audit-log';
import { useMediaQuery } from '@/hooks/use-media-query';

const PAGE_SIZE = 20;

type SortDir = 'asc' | 'desc';

// Same scope note as admin/users.tsx's SortIcon: this sorts only the
// fetched page (the API already orders created_at DESC — see
// admin-audit-log.repository.ts — and has no `sort` param to ask for
// anything else), not the full log. A real, working affordance on what is
// already on screen, not a stand-in for #106/#107/#108's backend sort.
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown size={12} strokeWidth={2} className="text-muted-foreground" />;
    return dir === 'asc' ? (
        <ArrowUp size={12} strokeWidth={2.5} />
    ) : (
        <ArrowDown size={12} strokeWidth={2.5} />
    );
}

// Keyed by the API's own enum. The label is looked up as
// `admin.audit.action.<enum>`, with the raw enum as the fallback for an action
// this build has no wording for yet.
const KNOWN_ACTIONS = new Set(['role_change', 'status_change']);

// Badge variant per action, so the action column reads at a glance in a
// dense table rather than as identical plain text down every row. An
// action this build has no wording for yet (KNOWN_ACTIONS above) falls
// back to "neutral" at the call site, not here.
const ACTION_BADGE_VARIANT: Record<string, 'info' | 'warning'> = {
    role_change: 'info',
    status_change: 'warning',
};

// types/api.ts declares actorId/targetUserId as non-null strings, but the
// DB foreign keys are ON DELETE SET NULL (admin_audit_log keeps the row
// when the actor or target account is later deleted, e.g. GDPR account
// deletion) — a real account can leave a null here despite the type. Found
// by an actual null row crashing this page (`Cannot read properties of
// null (reading 'slice')`) rather than by reading the type, so this
// guards the real API response, not just what the type promises.
function shortId(id: string | null | undefined): string {
    return id ? `${id.slice(0, 8)}…` : '—';
}

export default function AdminAuditLogPage() {
    const intl = useIntl();
    const [page, setPage] = useState(1);
    const auditLog = useAdminAuditLog(page, PAGE_SIZE);
    const totalPages = auditLog.data ? Math.max(1, Math.ceil(auditLog.data.total / PAGE_SIZE)) : 1;
    // Renders exactly one of {table, cards}, never both at once — see
    // use-media-query.ts for why a CSS hidden/md:block pair would double
    // every entry's accessible text in the DOM.
    const isDesktop = useMediaQuery('(min-width: 768px)');
    // Backend order is created_at DESC; 'desc' is the default here for the
    // same reason — the sort control starts in the state the data is
    // already in, so the first click is the one that visibly does something.
    const [whenSortDir, setWhenSortDir] = useState<SortDir>('desc');

    const actionLabel = (action: string) =>
        KNOWN_ACTIONS.has(action)
            ? intl.formatMessage({ id: `admin.audit.action.${action}` })
            : action;

    const sortedEntries = useMemo(() => {
        const list = auditLog.data?.entries ?? [];
        const sorted = [...list].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return whenSortDir === 'desc' ? sorted.reverse() : sorted;
    }, [auditLog.data, whenSortDir]);

    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-border pb-6">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    <FormattedMessage id="admin.audit.title" />
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                    <FormattedMessage id="admin.audit.subtitle" />
                </p>
            </div>

            {auditLog.isLoading &&
                (isDesktop ? (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <FormattedMessage id="admin.audit.colWhen" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.audit.colAction" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.audit.colChange" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.audit.colTarget" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.audit.colActor" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <Skeleton className="h-4 w-32" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-24" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-28" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-16" />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i}>
                                <CardContent className="space-y-2 p-4">
                                    <Skeleton className="h-3.5 w-28" />
                                    <Skeleton className="h-4 w-40" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ))}

            {auditLog.isError && !auditLog.isLoading && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-base text-muted-foreground">
                            <FormattedMessage id="admin.audit.loadError" />
                        </p>
                        <Button variant="outline" size="sm" onClick={() => void auditLog.refetch()}>
                            <FormattedMessage id="common.retry" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            {auditLog.data && !auditLog.isLoading && (
                <>
                    {auditLog.data.entries.length === 0 ? (
                        <Card>
                            <CardContent className="py-10">
                                <EmptyState
                                    icon={ClipboardList}
                                    title={intl.formatMessage({ id: 'admin.audit.emptyTitle' })}
                                    description={intl.formatMessage({ id: 'admin.audit.emptyBody' })}
                                    headingLevel={2}
                                />
                            </CardContent>
                        </Card>
                    ) : isDesktop ? (
                        // Desktop: dense table. Mobile (below) gets stacked cards — five
                        // columns of mostly short values would either overflow silently or
                        // crush the "When"/"Change" columns unreadably at phone widths, so
                        // mobile gets its own layout rather than a squeezed copy.
                        // Same sticky-header/bounded-scroll/min-width story as
                        // admin/users.tsx — see its comment for why each piece
                        // is there. Table's own overflow-x-auto wrapper
                        // (table.tsx, unchanged) is what turns min-w-[720px]
                        // into an actual horizontal scroll at a narrow width.
                        <Card className="overflow-hidden">
                            <div className="max-h-[560px] overflow-y-auto">
                                <Table className="min-w-[720px]">
                                    <TableHeader className="sticky top-0 z-10 bg-card">
                                        <TableRow>
                                            <TableHead aria-sort={whenSortDir === 'desc' ? 'descending' : 'ascending'}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setWhenSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                                                    }
                                                    className="inline-flex items-center gap-1"
                                                    aria-label={intl.formatMessage(
                                                        { id: 'admin.sort.by' },
                                                        {
                                                            column: intl.formatMessage({
                                                                id: 'admin.audit.colWhen',
                                                            }),
                                                        },
                                                    )}
                                                >
                                                    <FormattedMessage id="admin.audit.colWhen" />
                                                    <SortIcon active dir={whenSortDir} />
                                                </button>
                                            </TableHead>
                                            <TableHead>
                                                <FormattedMessage id="admin.audit.colAction" />
                                            </TableHead>
                                            <TableHead>
                                                <FormattedMessage id="admin.audit.colChange" />
                                            </TableHead>
                                            <TableHead>
                                                <FormattedMessage id="admin.audit.colTarget" />
                                            </TableHead>
                                            <TableHead>
                                                <FormattedMessage id="admin.audit.colActor" />
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* data-testid plus data-audit-action on every
                                            entry, in both layouts: the action column
                                            renders ACTION_LABELS' display copy
                                            ("Role changed"), which #219 translates,
                                            while entry.action is the raw enum
                                            ('role_change'). Matching the label also
                                            broke on a second run — a second
                                            role_change entry made the text locator
                                            ambiguous; a scoped entry row does not. */}
                                        {sortedEntries.map((entry) => (
                                            <TableRow
                                                key={entry.id}
                                                data-testid="audit-entry"
                                                data-audit-action={entry.action}
                                            >
                                                <TableCell className="tabular-nums whitespace-nowrap text-sm text-muted-foreground">
                                                    <FormattedDate value={entry.createdAt} />{' '}
                                                    <FormattedTime value={entry.createdAt} />
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={ACTION_BADGE_VARIANT[entry.action] ?? 'neutral'}>
                                                        {actionLabel(entry.action)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    <span className="font-mono">{entry.previousValue}</span>
                                                    {' → '}
                                                    <span className="font-mono text-foreground">
                                                        {entry.newValue}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {shortId(entry.targetUserId)}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {shortId(entry.actorId)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {sortedEntries.map((entry) => (
                                <Card
                                    key={entry.id}
                                    data-testid="audit-entry"
                                    data-audit-action={entry.action}
                                >
                                    <CardContent className="flex flex-col gap-2 p-4">
                                        <div className="flex items-center justify-between">
                                            <Badge variant={ACTION_BADGE_VARIANT[entry.action] ?? 'neutral'}>
                                                {actionLabel(entry.action)}
                                            </Badge>
                                            <span className="tabular-nums text-xs whitespace-nowrap text-muted-foreground">
                                                <FormattedDate value={entry.createdAt} />{' '}
                                                <FormattedTime value={entry.createdAt} />
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-mono">{entry.previousValue}</span>
                                            {' → '}
                                            <span className="font-mono text-foreground">
                                                {entry.newValue}
                                            </span>
                                        </p>
                                        <div className="flex items-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
                                            <span>
                                                <FormattedMessage id="admin.audit.target" />{' '}
                                                <span className="font-mono">
                                                    {shortId(entry.targetUserId)}
                                                </span>
                                            </span>
                                            <span>
                                                <FormattedMessage id="admin.audit.actor" />{' '}
                                                <span className="font-mono">
                                                    {shortId(entry.actorId)}
                                                </span>
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {auditLog.data && auditLog.data.total > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p className="tabular-nums">
                        <FormattedMessage
                            id="admin.audit.total"
                            values={{
                                count: auditLog.data.total,
                                page: intl.formatMessage(
                                    { id: 'common.pageOf' },
                                    { page, total: totalPages },
                                ),
                            }}
                        />
                    </p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => {
                                setPage((p) => p - 1);
                            }}
                        >
                            <FormattedMessage id="common.previous" />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => {
                                setPage((p) => p + 1);
                            }}
                        >
                            <FormattedMessage id="common.next" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
