import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
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

const ACTION_LABELS: Record<string, string> = {
    role_change: 'Role changed',
    status_change: 'Status changed',
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
    const [page, setPage] = useState(1);
    const auditLog = useAdminAuditLog(page, PAGE_SIZE);
    const totalPages = auditLog.data ? Math.max(1, Math.ceil(auditLog.data.total / PAGE_SIZE)) : 1;
    // Renders exactly one of {table, cards}, never both at once — see
    // use-media-query.ts for why a CSS hidden/md:block pair would double
    // every entry's accessible text in the DOM.
    const isDesktop = useMediaQuery('(min-width: 768px)');

    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-border pb-6">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    Audit log
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Every role and status change any admin has made, newest first.
                </p>
            </div>

            {auditLog.isLoading &&
                (isDesktop ? (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>When</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Change</TableHead>
                                    <TableHead>Target user</TableHead>
                                    <TableHead>Actor</TableHead>
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
                        <p className="text-sm text-muted-foreground">
                            Couldn't load the audit log.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => void auditLog.refetch()}>
                            Retry
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
                                    title="No admin actions yet"
                                    description="Role and status changes any admin makes will show up here, newest first."
                                    headingLevel={2}
                                />
                            </CardContent>
                        </Card>
                    ) : isDesktop ? (
                        // Desktop: dense table. Mobile (below) gets stacked cards — five
                        // columns of mostly short values would either overflow silently or
                        // crush the "When"/"Change" columns unreadably at phone widths, so
                        // mobile gets its own layout rather than a squeezed copy.
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>When</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Change</TableHead>
                                        <TableHead>Target user</TableHead>
                                        <TableHead>Actor</TableHead>
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
                                    {auditLog.data.entries.map((entry) => (
                                        <TableRow
                                            key={entry.id}
                                            data-testid="audit-entry"
                                            data-audit-action={entry.action}
                                        >
                                            <TableCell className="tabular-nums whitespace-nowrap text-sm text-muted-foreground">
                                                {new Date(entry.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {ACTION_LABELS[entry.action] ?? entry.action}
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
                        </Card>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {auditLog.data.entries.map((entry) => (
                                <Card
                                    key={entry.id}
                                    data-testid="audit-entry"
                                    data-audit-action={entry.action}
                                >
                                    <CardContent className="flex flex-col gap-2 p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-foreground">
                                                {ACTION_LABELS[entry.action] ?? entry.action}
                                            </span>
                                            <span className="tabular-nums text-xs whitespace-nowrap text-muted-foreground">
                                                {new Date(entry.createdAt).toLocaleString()}
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
                                                Target{' '}
                                                <span className="font-mono">
                                                    {shortId(entry.targetUserId)}
                                                </span>
                                            </span>
                                            <span>
                                                Actor{' '}
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
                        {auditLog.data.total.toLocaleString()} entr
                        {auditLog.data.total === 1 ? 'y' : 'ies'} — page {page} of {totalPages}
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
                            Previous
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
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
