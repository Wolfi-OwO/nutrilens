import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
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
import { ApiError } from '@/lib/api-client';
import type { PublicUser, UserRole } from '@/types/api';

const PAGE_SIZE = 20;
const ROLES: UserRole[] = ['user', 'coach', 'admin'];

const selectClassName =
    'h-11 rounded-lg border border-input bg-card px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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

export default function AdminUsersPage() {
    const { user: currentUser } = useAuth();
    const [q, setQ] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [role, setRole] = useState<UserRole | ''>('');
    const [status, setStatus] = useState<PublicUser['status'] | ''>('');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState<string | null>(null);

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

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Users</h1>
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
                <Button type="submit" variant="outline">
                    Search
                </Button>
            </form>

            {actionError && (
                <p
                    role="alert"
                    className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                    {actionError}
                </p>
            )}

            {users.isLoading && (
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
            )}

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
                <Card>
                    {users.data.users.length === 0 ? (
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            No users match these filters.
                        </CardContent>
                    ) : (
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
                                {users.data.users.map((target) => {
                                    const isSelf = target.id === currentUser?.id;
                                    return (
                                        <TableRow key={target.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={target.displayName}
                                                        seed={target.id}
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
                                                <select
                                                    value={target.role}
                                                    disabled={changeRoleStatus.isPending}
                                                    onChange={(e) => {
                                                        applyChange(target, {
                                                            role: e.target.value as UserRole,
                                                        });
                                                    }}
                                                    className={selectClassName}
                                                    aria-label={`Change role for ${target.email}`}
                                                >
                                                    {ROLES.map((r) => (
                                                        <option key={r} value={r}>
                                                            {r}
                                                        </option>
                                                    ))}
                                                </select>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={target.status} />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                                                {new Date(target.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {target.status !== 'deleted' && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={
                                                            changeRoleStatus.isPending ||
                                                            (isSelf && target.status === 'active')
                                                        }
                                                        title={
                                                            isSelf && target.status === 'active'
                                                                ? "You can't suspend your own account."
                                                                : undefined
                                                        }
                                                        onClick={() => {
                                                            applyChange(target, {
                                                                status:
                                                                    target.status === 'active'
                                                                        ? 'suspended'
                                                                        : 'active',
                                                            });
                                                        }}
                                                    >
                                                        {target.status === 'active'
                                                            ? 'Suspend'
                                                            : 'Reactivate'}
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            )}

            {users.data && users.data.total > 0 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <p>
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
