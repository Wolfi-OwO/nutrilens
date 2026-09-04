import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, UserX } from 'lucide-react';
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

// active -> "info" (primary-tinted, the same pairing the old inline
// bg-primary/10 text-primary-strong style used — this app's green is
// reserved for macro "on target", not account state), suspended -> "danger",
// deleted -> "neutral". Replaces a hand-rolled pill with the shared
// components/ui/badge.tsx primitive, this file's named consumer.
const STATUS_BADGE_VARIANT: Record<PublicUser['status'], 'info' | 'danger' | 'neutral'> = {
    active: 'info',
    suspended: 'danger',
    deleted: 'neutral',
};

function StatusBadge({ status }: { status: PublicUser['status'] }) {
    return (
        <Badge variant={STATUS_BADGE_VARIANT[status]}>
            <FormattedMessage id={`status.${status}`} />
        </Badge>
    );
}

type UserSortKey = 'name' | 'joined';
type SortDir = 'asc' | 'desc';

// The current PAGE only (up to PAGE_SIZE=20 rows) — GET /users has no `sort`
// param (see use-admin-users.ts), and adding one is #106/#107/#108's
// scaffold to extend, not this restyle's. A client-side sort of what is
// already on screen is still a real, working affordance in the meantime,
// not a placeholder.
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
    if (!active) return <ArrowUpDown size={12} strokeWidth={2} className="text-muted-foreground" />;
    return dir === 'asc' ? (
        <ArrowUp size={12} strokeWidth={2.5} />
    ) : (
        <ArrowDown size={12} strokeWidth={2.5} />
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
    const intl = useIntl();
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
            aria-label={intl.formatMessage(
                { id: 'admin.users.changeRoleFor' },
                { email: target.email },
            )}
        >
            {ROLES.map((r) => (
                <option key={r} value={r}>
                    {intl.formatMessage({ id: `role.${r}` })}
                </option>
            ))}
        </select>
    );
}

export default function AdminUsersPage() {
    const intl = useIntl();
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
    const [sortKey, setSortKey] = useState<UserSortKey | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>('asc');

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

    const toggleSort = (key: UserSortKey) => {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir('asc');
            return;
        }
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    };

    const ariaSortFor = (key: UserSortKey) =>
        sortKey !== key ? 'none' : sortDir === 'asc' ? 'ascending' : 'descending';

    // Sorts only the fetched page, not the full result set — see SortIcon's
    // comment above for why that scope is deliberate here.
    const sortedUsers = useMemo(() => {
        const list = users.data?.users ?? [];
        if (!sortKey) return list;
        const dirSign = sortDir === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const cmp =
                sortKey === 'name'
                    ? a.displayName.localeCompare(b.displayName, intl.locale)
                    : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return cmp * dirSign;
        });
    }, [users.data, sortKey, sortDir, intl.locale]);

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
                            : intl.formatMessage({ id: 'common.genericError' }),
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
                    <FormattedMessage id="admin.users.reactivate" />
                </Button>
            );
        }

        if (confirmingId === target.id) {
            return (
                <div
                    role="group"
                    aria-label={intl.formatMessage(
                        { id: 'admin.users.suspendConfirmGroup' },
                        { email: target.email },
                    )}
                    className="flex items-center justify-end gap-2"
                >
                    <span className="text-xs text-muted-foreground">
                        <FormattedMessage id="admin.users.suspendQuestion" />
                    </span>
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
                        <FormattedMessage id="admin.users.confirm" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setConfirmingId(null);
                        }}
                    >
                        <FormattedMessage id="common.cancel" />
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
                title={
                    isSelf
                        ? intl.formatMessage({ id: 'admin.users.cannotSuspendSelf' })
                        : undefined
                }
                onClick={() => {
                    setConfirmingId(target.id);
                }}
            >
                <FormattedMessage id="admin.users.suspend" />
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-border pb-6">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    <FormattedMessage id="admin.users.title" />
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                    <FormattedMessage id="admin.users.subtitle" />
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
                        placeholder={intl.formatMessage({ id: 'admin.users.searchPlaceholder' })}
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
                    aria-label={intl.formatMessage({ id: 'admin.users.filterByRole' })}
                >
                    <option value="">{intl.formatMessage({ id: 'admin.users.allRoles' })}</option>
                    {ROLES.map((r) => (
                        <option key={r} value={r}>
                            {intl.formatMessage({ id: `role.${r}` })}
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
                    aria-label={intl.formatMessage({ id: 'admin.users.filterByStatus' })}
                >
                    <option value="">
                        {intl.formatMessage({ id: 'admin.users.allStatuses' })}
                    </option>
                    <option value="active">{intl.formatMessage({ id: 'status.active' })}</option>
                    <option value="suspended">
                        {intl.formatMessage({ id: 'status.suspended' })}
                    </option>
                    <option value="deleted">{intl.formatMessage({ id: 'status.deleted' })}</option>
                </select>
                <Button type="submit" variant="outline" data-testid="user-search-submit">
                    <FormattedMessage id="admin.users.search" />
                </Button>
            </form>

            {actionError && (
                <p
                    role="alert"
                    className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
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
                                    <TableHead>
                                        <FormattedMessage id="admin.users.colUser" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.users.colRole" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.users.colStatus" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="admin.users.colJoined" />
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <FormattedMessage id="admin.users.colActions" />
                                    </TableHead>
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
                        <p className="text-base text-muted-foreground">
                            <FormattedMessage id="admin.users.loadError" />
                        </p>
                        <Button variant="outline" size="sm" onClick={() => void users.refetch()}>
                            <FormattedMessage id="common.retry" />
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
                                    title={intl.formatMessage({ id: 'admin.users.emptyTitle' })}
                                    description={
                                        searchTerm
                                            ? intl.formatMessage(
                                                  { id: 'admin.users.emptySearchBody' },
                                                  { query: searchTerm },
                                              )
                                            : intl.formatMessage({
                                                  id: 'admin.users.emptyFilterBody',
                                              })
                                    }
                                    action={
                                        hasFilters
                                            ? {
                                                  label: intl.formatMessage({
                                                      id: 'admin.users.clearFilters',
                                                  }),
                                                  onClick: clearFilters,
                                              }
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
                            {/* max-h + overflow-y-auto + a sticky thead: a dense
                                operations console keeps its column headers pinned
                                while a full page of rows scrolls, rather than
                                scrolling the header away with row 1. min-w-[720px]
                                on the table (below) is this page's horizontal-scroll
                                story — the User/Role/Status/Joined/Actions columns
                                do not get crushed at a narrow width, they scroll,
                                and Table's own overflow-x-auto wrapper (table.tsx,
                                unchanged) is what makes that possible. */}
                            <Card className="overflow-hidden">
                                <div className="max-h-[560px] overflow-y-auto">
                                    <Table className="min-w-[720px]">
                                        <TableHeader className="sticky top-0 z-10 bg-card">
                                            <TableRow>
                                                <TableHead aria-sort={ariaSortFor('name')}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSort('name')}
                                                        className="inline-flex items-center gap-1"
                                                        aria-label={intl.formatMessage(
                                                            { id: 'admin.sort.by' },
                                                            {
                                                                column: intl.formatMessage({
                                                                    id: 'admin.users.colUser',
                                                                }),
                                                            },
                                                        )}
                                                    >
                                                        <FormattedMessage id="admin.users.colUser" />
                                                        <SortIcon active={sortKey === 'name'} dir={sortDir} />
                                                    </button>
                                                </TableHead>
                                                <TableHead>
                                                    <FormattedMessage id="admin.users.colRole" />
                                                </TableHead>
                                                <TableHead>
                                                    <FormattedMessage id="admin.users.colStatus" />
                                                </TableHead>
                                                <TableHead aria-sort={ariaSortFor('joined')}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSort('joined')}
                                                        className="inline-flex items-center gap-1"
                                                        aria-label={intl.formatMessage(
                                                            { id: 'admin.sort.by' },
                                                            {
                                                                column: intl.formatMessage({
                                                                    id: 'admin.users.colJoined',
                                                                }),
                                                            },
                                                        )}
                                                    >
                                                        <FormattedMessage id="admin.users.colJoined" />
                                                        <SortIcon active={sortKey === 'joined'} dir={sortDir} />
                                                    </button>
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    <FormattedMessage id="admin.users.colActions" />
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {sortedUsers.map((target) => (
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
                                                    <FormattedDate value={target.createdAt} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {renderActions(target)}
                                                </TableCell>
                                            </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </Card>
                        </>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {sortedUsers.map((target) => (
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
                                                    <FormattedMessage id="admin.users.colJoined" />
                                                </span>
                                                <span className="text-sm tabular-nums text-foreground">
                                                    <FormattedDate value={target.createdAt} />
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
                        <FormattedMessage
                            id="admin.users.total"
                            values={{
                                count: users.data.total,
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
