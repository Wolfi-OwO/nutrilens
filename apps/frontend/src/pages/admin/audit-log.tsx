import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

const PAGE_SIZE = 20;

const ACTION_LABELS: Record<string, string> = {
    role_change: 'Role changed',
    status_change: 'Status changed',
};

export default function AdminAuditLogPage() {
    const [page, setPage] = useState(1);
    const auditLog = useAdminAuditLog(page, PAGE_SIZE);
    const totalPages = auditLog.data ? Math.max(1, Math.ceil(auditLog.data.total / PAGE_SIZE)) : 1;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-semibold text-foreground">Audit log</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Every role and status change any admin has made, newest first.
                </p>
            </div>

            {auditLog.isLoading && (
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
            )}

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
                <Card>
                    {auditLog.data.entries.length === 0 ? (
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            No admin actions have been recorded yet.
                        </CardContent>
                    ) : (
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
                                {auditLog.data.entries.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
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
                                            {entry.targetUserId.slice(0, 8)}…
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {entry.actorId.slice(0, 8)}…
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            )}

            {auditLog.data && auditLog.data.total > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p>
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
