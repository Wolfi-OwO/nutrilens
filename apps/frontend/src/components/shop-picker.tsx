import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    AlertCircle,
    ChevronLeft,
    Loader2,
    MapPin,
    Navigation,
    SearchX,
    Store as StoreIcon,
    Check,
    X,
} from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataAttribution } from '@/components/data-attribution';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDiscounters, useDiscounterStores, useNearbyStores } from '@/hooks/use-discounters';
import type { ShopSelection } from '@/lib/shop-memory';
import { cn } from '@/lib/utils';
import type { Discounter, NearbyStore, Store } from '@/types/api';

// Where the user bought this meal — optional, skippable, and pre-filled from
// the last one so the daily case costs zero interactions.
//
// WHAT THIS IS NOT: a claim that a chain sells a food. There is no assortment
// data behind it (Open Food Facts store tags cover 1–6.5% of Austrian products
// per chain), so nothing here may read as "available at Hofer". The only fact
// recorded is the user's own: this is where I shopped.
//
// The chain list is the only country seeded today, and it is 31 rows long — too
// many for a flat select, so it is a filter box over an already-fetched array
// (no request per keystroke) with the user's own recent chains lifted to the
// top and the rest ordered by how many branches they actually have. "Near me"
// is the shortcut that answers chain AND branch in one tap, and it is the only
// endpoint that can: /discounters/:code/stores is capped at 25 rows of a
// 1,067-row chain with no name or city search behind it.

const COUNTRY = 'AT';
const NEARBY_RADIUS_M = 5000;

interface ShopPickerProps {
    value: ShopSelection | null;
    onChange: (value: ShopSelection | null) => void;
    /** Chain codes to surface first, most recent first. */
    recentChains: string[];
    /** True while `value` is the remembered pre-fill and the user hasn't touched it. */
    fromMemory: boolean;
}

/** @returns A human label for a store row, or null when the row carries no address at all. */
function storeLabel(store: Store): string | null {
    const locality = [store.postalCode, store.city].filter(Boolean).join(' ');
    const parts = [store.address, locality].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
    // Falling back to `name` last on purpose: on OSM rows it is usually just the
    // brand again ("BILLA"), which would render as "Billa — Billa".
    return store.name;
}

/** @returns Metres under a kilometre, one decimal of a kilometre above it. */
function formatDistance(metres: number, intl: IntlShape): string {
    return metres < 1000
        ? intl.formatMessage({ id: 'shop.distanceMetres' }, { value: metres })
        : intl.formatMessage(
              { id: 'shop.distanceKilometres' },
              { value: Number((metres / 1000).toFixed(1)) },
          );
}

export function ShopPicker({ value, onChange, recentChains, fromMemory }: ShopPickerProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<'chains' | 'nearby'>('chains');
    const [filter, setFilter] = useState('');
    const [branchChain, setBranchChain] = useState<Discounter | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [geoError, setGeoError] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);

    const toggleRef = useRef<HTMLButtonElement>(null);
    const filterRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const panelId = useId();

    const discounters = useDiscounters(COUNTRY, open);
    const branches = useDiscounterStores(branchChain?.code ?? null, open);
    const nearby = useNearbyStores(mode === 'nearby' ? coords : null);

    // Focus the filter box when the panel opens: the panel exists to be searched,
    // and a keyboard user should not have to tab into it from the toggle.
    useEffect(() => {
        if (open && mode === 'chains' && !branchChain) filterRef.current?.focus();
    }, [open, mode, branchChain]);

    const closePanel = () => {
        setOpen(false);
        setBranchChain(null);
        setFilter('');
        // Focus goes back to the control that opened the panel, not to the top of
        // the document — the panel is gone, so leaving focus inside it would drop
        // the keyboard user's place in the form.
        toggleRef.current?.focus();
    };

    const chainsById = useMemo(() => {
        const map = new Map<string, Discounter>();
        for (const chain of discounters.data?.discounters ?? []) map.set(chain.id, chain);
        return map;
    }, [discounters.data]);

    // Recent first (in recency order), then everything else by branch count.
    // The API orders by name, which buries Billa/Spar/Hofer among 31 rows whose
    // real store counts differ by three orders of magnitude.
    const orderedChains = useMemo(() => {
        const all = discounters.data?.discounters ?? [];
        const recent = recentChains
            .map((code) => all.find((chain) => chain.code === code))
            .filter((chain): chain is Discounter => !!chain);
        const rest = all
            .filter((chain) => !recent.some((r) => r.id === chain.id))
            .sort((a, b) => b.storeCount - a.storeCount);
        return { recent, rest };
    }, [discounters.data, recentChains]);

    const needle = filter.trim().toLowerCase();
    const matches = (chain: Discounter) => chain.name.toLowerCase().includes(needle);
    const shownRecent = needle ? orderedChains.recent.filter(matches) : orderedChains.recent;
    const shownRest = needle ? orderedChains.rest.filter(matches) : orderedChains.rest;
    const noChainMatches = needle.length > 0 && shownRecent.length === 0 && shownRest.length === 0;

    const selectChain = (chain: Discounter) => {
        // Selecting the chain commits immediately — the branch below is a refinement,
        // not a second required step, so closing the panel here is already a complete
        // answer.
        onChange({ chainCode: chain.code, chainName: chain.name });
        setBranchChain(chain);
        setFilter('');
    };

    const selectStore = (store: Store | NearbyStore, chain: Discounter | undefined) => {
        const label = storeLabel(store);
        onChange({
            chainCode: chain?.code ?? value?.chainCode ?? '',
            chainName: chain?.name ?? value?.chainName ?? '',
            storeId: store.id,
            ...(label ? { storeLabel: label } : {}),
        });
        closePanel();
    };

    const requestLocation = () => {
        setGeoError(null);
        if (!navigator.geolocation) {
            setGeoError(intl.formatMessage({ id: 'shop.geoUnsupported' }));
            return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocating(false);
                setCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
            },
            (error) => {
                setLocating(false);
                setGeoError(
                    intl.formatMessage({
                        id:
                            error.code === error.PERMISSION_DENIED
                                ? 'shop.geoDenied'
                                : 'shop.geoFailed',
                    }),
                );
            },
            { timeout: 10_000, maximumAge: 5 * 60 * 1000 },
        );
    };

    // Arrow keys move focus between the option buttons. They are real buttons, so
    // Tab and Enter already work natively and this is a convenience on top —
    // 31 chains is a lot of tab stops.
    const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const options = Array.from(
            listRef.current?.querySelectorAll<HTMLButtonElement>('[data-shop-option]') ?? [],
        );
        if (options.length === 0) return;
        const current = options.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        const next =
            event.key === 'ArrowDown'
                ? current < 0
                    ? 0
                    : (current + 1) % options.length
                : current <= 0
                  ? options.length - 1
                  : current - 1;
        options[next]?.focus();
    };

    const liveMessage = !open
        ? ''
        : mode === 'nearby'
          ? locating
              ? intl.formatMessage({ id: 'shop.locating' })
              : geoError
                ? geoError
                : !coords
                  ? ''
                  : nearby.isFetching
                    ? intl.formatMessage({ id: 'shop.live.searchingNearby' })
                    : nearby.isError
                      ? intl.formatMessage({ id: 'shop.live.nearbyFailed' })
                      : intl.formatMessage(
                            { id: 'shop.live.storesFound' },
                            {
                                count: nearby.data?.stores.length ?? 0,
                                km: NEARBY_RADIUS_M / 1000,
                            },
                        )
          : branchChain
            ? branches.isFetching
                ? intl.formatMessage({ id: 'shop.loadingBranches' })
                : intl.formatMessage(
                      { id: 'shop.live.branchesListed' },
                      {
                          count: branches.data?.stores.length ?? 0,
                          chain: branchChain.name,
                      },
                  )
            : discounters.isFetching
              ? intl.formatMessage({ id: 'shop.loadingChains' })
              : discounters.isError
                ? intl.formatMessage({ id: 'shop.live.chainsFailed' })
                : needle
                  ? intl.formatMessage(
                        { id: 'shop.live.chainsMatch' },
                        {
                            count: shownRecent.length + shownRest.length,
                            query: filter.trim(),
                        },
                    )
                  : '';

    return (
        <section
            aria-labelledby={`${panelId}-heading`}
            // border-border-key once a shop is recorded: the same key-tile edge
            // MealTotals uses, marking this as a fact now attached to the log
            // rather than a still-empty optional block.
            className={cn('rounded-xl border bg-card', value ? 'border-border-key' : 'border-border')}
        >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0">
                    <h2
                        id={`${panelId}-heading`}
                        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                        <FormattedMessage id="shop.heading" />
                        {/* Spelled out, not implied by a lighter shade: this whole block is
                skippable and a required-looking field would slow down the one
                thing the page is for. */}
                        <span className="ml-1.5 font-normal normal-case">
                            <FormattedMessage id="shop.optional" />
                        </span>
                    </h2>
                    {value ? (
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-display font-semibold text-foreground">
                                {value.chainName}
                            </span>
                            {value.storeLabel && (
                                <span className="text-muted-foreground">{value.storeLabel}</span>
                            )}
                            {fromMemory && (
                                <Badge variant="neutral">
                                    <FormattedMessage id="shop.remembered" />
                                </Badge>
                            )}
                        </p>
                    ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                            <FormattedMessage id="shop.notRecorded" />
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {/* data-testid: this button's label is not just display copy,
                        it also changes with state ("Add a shop" / "Change" /
                        "Close"), so no single accessible name identifies it.
                        accessibility.spec.ts clicks it to reach the open panel —
                        the third DOM state it scans. */}
                    <Button
                        ref={toggleRef}
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="shop-picker-toggle"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => {
                            if (open) closePanel();
                            else setOpen(true);
                        }}
                        className="gap-2 text-muted-foreground"
                    >
                        <StoreIcon size={16} strokeWidth={2} aria-hidden="true" />
                        <FormattedMessage id={open ? 'shop.close' : value ? 'shop.change' : 'shop.add'} />
                    </Button>
                    {value && (
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            // aria-label carries the item it clears; a bare "Clear" would read
                            // identically to every other clear button on the page.
                            aria-label={intl.formatMessage({ id: 'shop.clear' })}
                            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                            <X size={16} strokeWidth={2} />
                        </button>
                    )}
                </div>
            </div>

            <span className="sr-only" role="status" aria-live="polite">
                {liveMessage}
            </span>

            {open && (
                <div
                    id={panelId}
                    className="border-t border-border p-4"
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            closePanel();
                        }
                    }}
                >
                    {branchChain ? (
                        <BranchStep
                            chain={branchChain}
                            response={branches.data}
                            isFetching={branches.isFetching}
                            isError={branches.isError}
                            listRef={listRef}
                            onListKeyDown={handleListKeyDown}
                            onBack={() => setBranchChain(null)}
                            onPickStore={(store) => selectStore(store, branchChain)}
                            onDone={closePanel}
                            onUseLocation={() => {
                                setBranchChain(null);
                                setMode('nearby');
                                if (!coords) requestLocation();
                            }}
                        />
                    ) : (
                        <>
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="min-w-0 flex-1">
                                    <Label htmlFor={`${panelId}-filter`}>
                                        <FormattedMessage id="shop.findChain" />
                                    </Label>
                                    <Input
                                        id={`${panelId}-filter`}
                                        ref={filterRef}
                                        type="search"
                                        // A filter over 31 rows already in memory: no debounce, no
                                        // request per keystroke, nothing charged to the shared rate
                                        // limit. The food search needs those; this does not.
                                        value={filter}
                                        onChange={(event) => {
                                            setFilter(event.target.value);
                                            setMode('chains');
                                        }}
                                        placeholder={intl.formatMessage({
                                            id: 'shop.filterPlaceholder',
                                        })}
                                        autoComplete="off"
                                        className="mt-1.5"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant={mode === 'nearby' ? 'secondary' : 'outline'}
                                    onClick={() => {
                                        setMode('nearby');
                                        if (!coords) requestLocation();
                                    }}
                                    className="gap-2"
                                >
                                    <Navigation size={16} strokeWidth={2} aria-hidden="true" />
                                    <FormattedMessage id="shop.nearMe" />
                                </Button>
                            </div>

                            {mode === 'nearby' && (
                                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3">
                                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                        <FormattedMessage
                                            id="shop.withinRadius"
                                            values={{ km: NEARBY_RADIUS_M / 1000 }}
                                        />
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMode('chains');
                                            filterRef.current?.focus();
                                        }}
                                        className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                                    >
                                        <FormattedMessage id="shop.browseChains" />
                                    </button>
                                </div>
                            )}

                            <div ref={listRef} onKeyDown={handleListKeyDown} className="mt-3">
                                {mode === 'nearby' ? (
                                    <NearbyList
                                        locating={locating}
                                        geoError={geoError}
                                        coords={coords}
                                        isFetching={nearby.isFetching}
                                        isError={nearby.isError}
                                        stores={nearby.data?.stores ?? []}
                                        chainsById={chainsById}
                                        onRetry={requestLocation}
                                        onBrowseChains={() => {
                                            setMode('chains');
                                            filterRef.current?.focus();
                                        }}
                                        onPickStore={(store) =>
                                            selectStore(store, chainsById.get(store.discounterId))
                                        }
                                    />
                                ) : discounters.isFetching ? (
                                    <StatusLine
                                        icon={
                                            <Loader2
                                                size={14}
                                                strokeWidth={2}
                                                className="animate-spin"
                                            />
                                        }
                                    >
                                        <FormattedMessage id="shop.loadingChains" />
                                    </StatusLine>
                                ) : discounters.isError ? (
                                    <div className="flex flex-col items-start gap-2 py-2">
                                        <StatusLine
                                            alert
                                            icon={
                                                <AlertCircle
                                                    size={14}
                                                    strokeWidth={2}
                                                    className="text-destructive"
                                                />
                                            }
                                        >
                                            <FormattedMessage id="shop.chainsFailed" />
                                        </StatusLine>
                                        <button
                                            type="button"
                                            onClick={() => void discounters.refetch()}
                                            className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                                        >
                                            <FormattedMessage id="common.tryAgain" />
                                        </button>
                                    </div>
                                ) : noChainMatches ? (
                                    <div className="flex flex-col items-start gap-2 py-2">
                                        <StatusLine icon={<SearchX size={14} strokeWidth={2} />}>
                                            <FormattedMessage
                                                id="shop.noChainMatch"
                                                values={{ query: filter.trim() }}
                                            />
                                        </StatusLine>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter('');
                                                filterRef.current?.focus();
                                            }}
                                            className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                                        >
                                            <FormattedMessage id="shop.clearFilter" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {shownRecent.length > 0 && (
                                            <ChainGroup
                                                title={intl.formatMessage({
                                                    id: 'shop.recentlyUsed',
                                                })}
                                                chains={shownRecent}
                                                selectedCode={value?.chainCode}
                                                onSelect={selectChain}
                                            />
                                        )}
                                        {shownRest.length > 0 && (
                                            <ChainGroup
                                                title={
                                                    shownRecent.length > 0
                                                        ? intl.formatMessage({
                                                              id: 'shop.allChains',
                                                          })
                                                        : intl.formatMessage(
                                                              { id: 'shop.allChainsInAustria' },
                                                              { count: shownRest.length },
                                                          )
                                                }
                                                chains={shownRest}
                                                selectedCode={value?.chainCode}
                                                onSelect={selectChain}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* The credit travels with the rows it covers: the chain list's
                  storeCount is derived from OSM rows, /stores/near returns them
                  directly. Undefined in, nothing rendered. */}
                            <DataAttribution
                                attribution={
                                    mode === 'nearby'
                                        ? nearby.data?.attribution
                                        : discounters.data?.attribution
                                }
                                className="mt-3"
                            />
                        </>
                    )}
                </div>
            )}

            {(value || open) && (
                <p className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    <FormattedMessage id="shop.deviceOnly" />
                </p>
            )}
        </section>
    );
}

// alert is opt-in, not inferred from the icon: StatusLine renders loading and
// empty states too, and marking those as alerts would announce "no branches
// found" with the same urgency as a real fetch failure.
function StatusLine({
    icon,
    children,
    alert,
}: {
    icon: React.ReactNode;
    children: React.ReactNode;
    alert?: boolean;
}) {
    return (
        <p
            role={alert ? 'alert' : undefined}
            className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
        >
            <span className="shrink-0" aria-hidden="true">
                {icon}
            </span>
            {children}
        </p>
    );
}

function ChainGroup({
    title,
    chains,
    selectedCode,
    onSelect,
}: {
    title: string;
    chains: Discounter[];
    selectedCode: string | undefined;
    onSelect: (chain: Discounter) => void;
}) {
    return (
        <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {title}
            </p>
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-border">
                {chains.map((chain) => (
                    <li key={chain.id} className="border-b border-border last:border-0">
                        <button
                            type="button"
                            data-shop-option
                            // aria-current, not aria-pressed: picking a chain is a choice
                            // within a list, not a toggle that stays down.
                            aria-current={chain.code === selectedCode ? true : undefined}
                            onClick={() => onSelect(chain)}
                            className={cn(
                                'flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors',
                                chain.code === selectedCode ? 'bg-secondary' : 'hover:bg-muted',
                            )}
                        >
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                {chain.name}
                            </span>
                            {/* A branch count, deliberately not an assortment claim — this
                  says how many shops exist, never what any of them stocks. */}
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                <FormattedMessage
                                    id="shop.branchCount"
                                    values={{ count: chain.storeCount }}
                                />
                            </span>
                            {chain.code === selectedCode && (
                                <Check
                                    size={14}
                                    strokeWidth={2.5}
                                    className="shrink-0 text-accent"
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function BranchStep({
    chain,
    response,
    isFetching,
    isError,
    listRef,
    onListKeyDown,
    onBack,
    onPickStore,
    onDone,
    onUseLocation,
}: {
    chain: Discounter;
    response: { stores: Store[]; attribution?: string } | undefined;
    isFetching: boolean;
    isError: boolean;
    listRef: React.RefObject<HTMLDivElement | null>;
    onListKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    onBack: () => void;
    onPickStore: (store: Store) => void;
    onDone: () => void;
    onUseLocation: () => void;
}) {
    const stores = response?.stores ?? [];
    // The endpoint's ceiling is 25 rows and Billa has ~1,067 branches, so this
    // page is a sample, not the list. Saying so is the difference between a
    // useful shortcut and a picker that looks broken when a branch is missing.
    const isPartial = stores.length > 0 && chain.storeCount > stores.length;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                    <FormattedMessage id="shop.allChainsBack" />
                </button>
                <Button type="button" variant="ghost" size="sm" onClick={onDone} className="gap-2">
                    <Check size={16} strokeWidth={2} aria-hidden="true" />
                    <FormattedMessage id="shop.justChainIsFine" values={{ chain: chain.name }} />
                </Button>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
                <FormattedMessage
                    id="shop.chainRecorded"
                    values={{
                        chain: chain.name,
                        name: (chunks) => (
                            <span className="font-medium text-foreground">{chunks}</span>
                        ),
                    }}
                />
            </p>

            <div ref={listRef} onKeyDown={onListKeyDown} className="mt-3">
                {isFetching ? (
                    <StatusLine
                        icon={<Loader2 size={14} strokeWidth={2} className="animate-spin" />}
                    >
                        <FormattedMessage id="shop.loadingBranches" />
                    </StatusLine>
                ) : isError ? (
                    <StatusLine
                        alert
                        icon={
                            <AlertCircle size={14} strokeWidth={2} className="text-destructive" />
                        }
                    >
                        <FormattedMessage id="shop.branchesFailed" values={{ chain: chain.name }} />
                    </StatusLine>
                ) : stores.length === 0 ? (
                    <StatusLine icon={<MapPin size={14} strokeWidth={2} />}>
                        <FormattedMessage
                            id="shop.noBranchAddresses"
                            values={{ chain: chain.name }}
                        />
                    </StatusLine>
                ) : (
                    <ul className="max-h-64 overflow-y-auto rounded-lg border border-border">
                        {stores.map((store) => {
                            const label = storeLabel(store);
                            return (
                                <li key={store.id} className="border-b border-border last:border-0">
                                    <button
                                        type="button"
                                        data-shop-option
                                        onClick={() => onPickStore(store)}
                                        className="flex min-h-11 w-full flex-col justify-center gap-0.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                                    >
                                        <span className="font-medium text-foreground">
                                            {label ?? chain.name}
                                        </span>
                                        {store.city && label !== store.city && (
                                            <span className="text-xs text-muted-foreground">
                                                {store.city}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {isPartial && (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    <FormattedMessage
                        id="shop.showingSome"
                        values={{
                            shown: stores.length,
                            total: chain.storeCount,
                            chain: chain.name,
                            location: (chunks) => (
                                <button
                                    type="button"
                                    onClick={onUseLocation}
                                    className="font-semibold text-primary-strong underline underline-offset-2"
                                >
                                    {chunks}
                                </button>
                            ),
                        }}
                    />
                </p>
            )}

            <DataAttribution attribution={response?.attribution} className="mt-3" />
        </div>
    );
}

function NearbyList({
    locating,
    geoError,
    coords,
    isFetching,
    isError,
    stores,
    chainsById,
    onRetry,
    onBrowseChains,
    onPickStore,
}: {
    locating: boolean;
    geoError: string | null;
    coords: { lat: number; lon: number } | null;
    isFetching: boolean;
    isError: boolean;
    stores: NearbyStore[];
    chainsById: Map<string, Discounter>;
    onRetry: () => void;
    onBrowseChains: () => void;
    onPickStore: (store: NearbyStore) => void;
}) {
    const intl = useIntl();

    if (locating) {
        return (
            <StatusLine icon={<Loader2 size={14} strokeWidth={2} className="animate-spin" />}>
                <FormattedMessage id="shop.locating" />
            </StatusLine>
        );
    }

    if (geoError) {
        return (
            <div className="flex flex-col items-start gap-2 py-2">
                <StatusLine
                    alert
                    icon={<AlertCircle size={14} strokeWidth={2} className="text-destructive" />}
                >
                    {geoError}
                </StatusLine>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                    >
                        <FormattedMessage id="common.tryAgain" />
                    </button>
                    <button
                        type="button"
                        onClick={onBrowseChains}
                        className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                    >
                        <FormattedMessage id="shop.browseChains" />
                    </button>
                </div>
            </div>
        );
    }

    if (!coords) {
        return (
            <p className="py-2 text-sm text-muted-foreground">
                <FormattedMessage
                    id="shop.locationOnce"
                    values={{ km: NEARBY_RADIUS_M / 1000 }}
                />
            </p>
        );
    }

    if (isFetching) {
        return (
            <StatusLine icon={<Loader2 size={14} strokeWidth={2} className="animate-spin" />}>
                <FormattedMessage id="shop.searchingNearby" />
            </StatusLine>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-start gap-2 py-2">
                <StatusLine
                    alert
                    icon={<AlertCircle size={14} strokeWidth={2} className="text-destructive" />}
                >
                    <FormattedMessage id="shop.nearbySearchFailed" />
                </StatusLine>
                <button
                    type="button"
                    onClick={onRetry}
                    className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                >
                    <FormattedMessage id="common.tryAgain" />
                </button>
            </div>
        );
    }

    if (stores.length === 0) {
        return (
            <div className="flex flex-col items-start gap-2 py-2">
                <StatusLine icon={<MapPin size={14} strokeWidth={2} />}>
                    <FormattedMessage
                        id="shop.noneNearby"
                        values={{ km: NEARBY_RADIUS_M / 1000 }}
                    />
                </StatusLine>
                <button
                    type="button"
                    onClick={onBrowseChains}
                    className="text-sm font-semibold text-primary-strong underline underline-offset-2"
                >
                    <FormattedMessage id="shop.browseChainsInstead" />
                </button>
            </div>
        );
    }

    return (
        <ul className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {stores.map((store) => {
                const chain = chainsById.get(store.discounterId);
                const label = storeLabel(store);
                return (
                    <li key={store.id} className="border-b border-border last:border-0">
                        <button
                            type="button"
                            data-shop-option
                            onClick={() => onPickStore(store)}
                            className="flex min-h-11 w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground">
                                    {chain?.name ??
                                        store.name ??
                                        intl.formatMessage({ id: 'shop.unnamedShop' })}
                                </span>
                                {label && (
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {label}
                                    </span>
                                )}
                            </span>
                            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                {formatDistance(store.distanceM, intl)}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
