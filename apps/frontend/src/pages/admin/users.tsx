import { useState } from 'react';
import { Search, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAdminUsers, useChangeUserRoleStatus } from '@/hooks/use-admin-users';
import { useAuth } from '@/hooks/use-auth';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ApiError } from '@/lib/api-client';
import type { PublicUser, UserRole } from '@/types/api';

const PAGE_SIZE = 20;
const ROLES: UserRole[] = ['user', 'coach', 'admin'];

const selectClassName =
    'h-11 rounded-md border border-input bg-card px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function StatusBadge({ status }: { status: PublicUser['status'] }) {
    const styles: Record<PublicUser['status'], string> = {
        active: 'bg-primary/10 text-primary',
        suspended: 'bg-destructive/10 text-destructive',
        deleted: 'bg-muted text-muted-foreground',
    };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
        >
            {status}
        </span>
    );
}

function RoleSelect({
    target,
    disabled,
    onChange,
}: {
    target: PublicUser;
    disabled: boolean;
    onChange: (role: UserRole) => void;
}) {
    return (
        <select
            value={target.role}
            disabled={disabled}
            onChange={(e) => {
                onChange(e.target.value as UserRole);
            }}
            className={selectClassName}
            // data-testid: the accessible name is "Change role for <email>",
            // whose leading half is display copy #219 translates. Scoped to a
            // row by the caller, so one handle per row is unambiguous.
            data-testid="role-select"
            aria-label={`Change role for ${target.email}`}
        >
            {ROLES.map((r) => (
                <option key={r} value={r}>
                    {r}
                </option>
            ))}
        </select>
    );
}

export default function AdminUsersPage() {
    const { user: currentUser } = useAuth();
    const [q, setQ] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [role, setRole] = useState<UserRole | ''>('');
    const [status, setStatus] = useState<PublicUser['status'] | ''>('');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState<string | null>(null);
    // Which row's Suspend button is mid-confirmation — a real confirm step
    // for a destructive action, without reaching for window.confirm() or
    // any modal dialog. Reactivate isn't destructive, so it never sets this.
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    // Renders exactly one of {table, cards} — see use-media-query.ts for
    // why this can't be a CSS-only hidden/md:block pair.
    const isDesktop = useMediaQuery('(min-width: 768px)');

    const hasFilters = searchTerm !== '' || role !== '' || status !== '';
    const filters = {
        q: searchTerm || undefined,
        role: role || undefined,
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
    };
    const users = useAdminUsers(filters);
    const changeRoleStatus = useChangeUserRoleStatus();

    const totalPages = users.data ? Math.max(1, Math.ceil(users.data.total / PAGE_SIZE)) : 1;

    const applyChange = (
        target: PublicUser,
        body: { role?: UserRole; status?: 'active' | 'suspended' },
    ) => {
        setActionError(null);
        changeRoleStatus.mutate(
            { id: target.id, ...body },
            {
                onError: (error) => {
                    setActionError(
                        error instanceof ApiError
                            ? error.message
                            : 'Something went wrong. Please try again.',
                    );
                },
            },
        );
    };

    const clearFilters = () => {
        setQ('');
        setSearchTerm('');
        setRole('');
        setStatus('');
        setPage(1);
    };

    // Shared between the desktop table cell and the mobile card footer —
    // one place owning the suspend/reactivate/confirm logic instead of two
    // copies of the same branching drifting apart over time.
    function renderActions(target: PublicUser) {
        if (target.status === 'deleted') return null;

        const pending = changeRoleStatus.isPending;

        if (target.status !== 'active') {
            return (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                        applyChange(target, { status: 'active' });
                    }}
                >
                    Reactivate
                </Button>
            );
        }

        if (confirmingId === target.id) {
            return (
                <div
                    role="group"
                    aria-label={`Confirm suspend for ${target.email}`}
                    className="flex items-center justify-end gap-2"
                >
                    <span className="text-xs text-muted-foreground">Suspend?</span>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                            setConfirmingId(null);
                            applyChange(target, { status: 'suspended' });
                        }}
                    >
                        Confirm
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setConfirmingId(null);
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            );
        }

        const isSelf = target.id === currentUser?.id;
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending || isSelf}
                title={isSelf ? "You can't suspend your own account." : undefined}
                onClick={() => {
                    setConfirmingId(target.id);
                }}
            >
                Suspend
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-border pb-6">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    Users
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Search, filter, and manage every account.
                </p>
            </div>

            <form
                className="flex flex-col gap-3 sm:flex-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                    setSearchTerm(q);
                }}
            >
                <div className="relative flex-1">
                    <Search
                        size={16}
                        strokeWidth={2}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                        }}
                        placeholder="Search by email or name…"
                        className="pl-10"
                        data-testid="user-search-input"
                    />
                </div>
                <select
                    value={role}
                    onChange={(e) => {
                        setPage(1);
                        setRole(e.target.value as UserRole | '');
                    }}
                    className={selectClassName}
                    aria-label="Filter by role"
                >
                    <option value="">All roles</option>
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </select>
                <select
                    value={status}
                    onChange={(e) => {
                        setPage(1);
                        setStatus(e.target.value as PublicUser['status'] | '');
                    }}
                    className={selectClassName}
                    aria-label="Filter by status"
                >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="deleted">Deleted</option>
                </select>
                <Button type="submit" variant="outline" data-testid="user-search-submit">
                    Search
                </Button>
            </form>

            {actionError && (
                <p
                    role="alert"
                    className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                    {actionError}
                </p>
            )}

            {users.isLoading &&
                (isDesktop ? (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                                                <div>
                                                    <Skeleton className="mb-1.5 h-4 w-32" />
                                                    <Skeleton className="h-3 w-40" />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-11 w-24 rounded-lg" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-6 w-16 rounded-full" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-20" />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Skeleton className="ml-auto h-9 w-20 rounded-lg" />
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
                                <CardContent className="flex items-center gap-3 p-4">
                                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                                    <div className="min-w-0 flex-1">
                                        <Skeleton className="mb-1.5 h-4 w-32" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ))}

            {users.isError && !users.isLoading && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">Couldn't load users.</p>
                        <Button variant="outline" size="sm" onClick={() => void users.refetch()}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {users.data && !users.isLoading && (
                <>
                    {users.data.users.length === 0 ? (
                        <Card>
                            <CardContent className="py-10">
                                <EmptyState
                                    icon={UserX}
                                    title="No users match these filters"
                                    description={
                                        searchTerm
                                            ? `Nobody matched "${searchTerm}" with the current role/status filters. Try a different search or clear the filters.`
                                            : "Nobody matches the role/status filters you've set. Clear them to see everyone."
                                    }
                                    action={
                                        hasFilters
                                            ? { label: 'Clear filters', onClick: clearFilters }
                                            : undefined
                                    }
                                    headingLevel={2}
                                />
                            </CardContent>
                        </Card>
                    ) : isDesktop ? (
                        // Desktop: dense table. Mobile (below) gets stacked cards instead
                        // — the User/Role/Status/Joined/Actions columns don't survive a
                        // phone width without either crushing the role <select> or forcing
                        // a silent horizontal scroll, so it's a real fallback layout, not
                        // the same markup squeezed smaller. Rendered as an either/or via
                        // useMediaQuery rather than a CSS hidden/md:block pair — see
                        // use-media-query.ts for why duplicating every row into both a
                        // <table> and a stack of <Card>s at once breaks exact-text lookups.
                        <>
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>User</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Joined</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.data.users.map((target) => (
                                            <TableRow key={target.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar
                                                            name={target.displayName}
                                                            seed={target.id}
                                                            src={target.avatarUrl}
                                                            size="sm"
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium text-foreground">
                                                                {target.displayName}
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {target.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <RoleSelect
                                                        target={target}
                                                        disabled={changeRoleStatus.isPending}
                                                        onChange={(newRole) => {
                                                            applyChange(target, { role: newRole });
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={target.status} />
                                                </TableCell>
                                                <TableCell className="tabular-nums whitespace-nowrap text-sm text-muted-foreground">
                                                    {new Date(target.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {renderActions(target)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {users.data.users.map((target) => (
                                <Card key={target.id}>
                                    <CardContent className="flex flex-col gap-3 p-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                name={target.displayName}
                                                seed={target.id}
                                                src={target.avatarUrl}
                                                size="md"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium text-foreground">
                                                    {target.displayName}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {target.email}
                                                </p>
                                            </div>
                                            <StatusBadge status={target.status} />
                                        </div>
                                        <div className="flex items-center justify-between border-t border-border pt-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                                    Joined
                                                </span>
                                                <span className="text-sm tabular-nums text-foreground">
                                                    {new Date(target.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <RoleSelect
                                                target={target}
                                                disabled={changeRoleStatus.isPending}
                                                onChange={(newRole) => {
                                                    applyChange(target, { role: newRole });
                                                }}
                                            />
                                        </div>
                                        <div className="flex justify-end">{renderActions(target)}</div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </>
            )}

            {users.data && users.data.total > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p className="tabular-nums">
                        {users.data.total.toLocaleString()} user{users.data.total === 1 ? '' : 's'}{' '}
                        — page {page} of {totalPages}
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
