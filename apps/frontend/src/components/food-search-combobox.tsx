import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Loader2, SearchX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useFoodCatalog } from '@/hooks/use-food-catalog';
import { cn } from '@/lib/utils';

// Structural, not duplicated: pulled from the hook's own return type so this
// stays in sync with apps/api's catalog response shape without redeclaring
// its fields by hand.
export type FoodSearchResult = NonNullable<ReturnType<typeof useFoodCatalog>['data']>[number];

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;
const RESULT_LIMIT = 8;

interface FoodSearchComboboxProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    onSelect: (item: FoodSearchResult) => void;
    inputRef?: React.Ref<HTMLInputElement>;
    placeholder?: string;
    'aria-invalid'?: boolean;
}

export function FoodSearchCombobox({
    id,
    value,
    onChange,
    onBlur,
    onSelect,
    inputRef,
    placeholder,
    'aria-invalid': ariaInvalid,
}: FoodSearchComboboxProps) {
    const [hasFocus, setHasFocus] = useState(false);
    // Separate from hasFocus on purpose: selecting an option or pressing
    // Escape closes the panel WITHOUT moving DOM focus off the input (the
    // ARIA combobox pattern keeps focus in the textbox), so a "closed" state
    // driven only by focus never gets a fresh focus event to reopen on the
    // next keystroke. dismissed resets on every edit and on refocus instead.
    const [dismissed, setDismissed] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxId = useId();

    const trimmed = value.trim();

    // apiRateLimiter caps the whole app — page loads and static assets included —
    // at 300 req/15min per IP (apps/api/src/middlewares/rate-limit.ts); its own
    // comment records a handful of page loads once 429'ing the app off the page.
    // A per-keystroke search would reproduce that. The 3-char floor plus this
    // 400ms settle delay means one request per pause in typing, not one per key.
    useEffect(() => {
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setDebouncedQuery('');
            return;
        }
        const timer = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [trimmed]);

    // Gating the fetch itself on !dismissed (not just hiding the panel) means
    // picking a result doesn't fire a hidden, wasted search for the newly-set
    // description text — one less request against the shared rate limit.
    const searchEnabled = hasFocus && !dismissed && debouncedQuery.length >= MIN_QUERY_LENGTH;
    const {
        data: results,
        isFetching,
        isError,
        refetch,
    } = useFoodCatalog(debouncedQuery, RESULT_LIMIT, searchEnabled);

    const showHint = hasFocus && !dismissed && trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;
    const open = showHint || searchEnabled;
    const options = searchEnabled && results ? results : [];

    // Reset the highlighted option whenever the option list itself changes,
    // rather than trying to preserve a position that may no longer exist.
    useEffect(() => {
        setActiveIndex(-1);
    }, [results]);

    useEffect(() => {
        if (!open) return;
        const handleOutsideClick = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setHasFocus(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [open]);

    const selectOption = (item: FoodSearchResult) => {
        onSelect(item);
        setDismissed(true);
        setActiveIndex(-1);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (options.length > 0) {
                setActiveIndex((index) => (index + 1) % options.length);
            }
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (options.length > 0) {
                setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
            }
        } else if (event.key === 'Enter') {
            // Prevented unconditionally while the panel is open, active option or
            // not — this field lives inside the multi-item meal form, and letting
            // Enter fall through to a form submit while the user is still
            // browsing search results would submit the whole meal by accident.
            event.preventDefault();
            const active = options[activeIndex];
            if (active) selectOption(active);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            setDismissed(true);
            setActiveIndex(-1);
        }
    };

    const activeOptionId =
        activeIndex >= 0 && options[activeIndex] ? `${listboxId}-option-${options[activeIndex].fdcId}` : undefined;

    const liveMessage = !searchEnabled
        ? ''
        : isFetching
          ? 'Searching…'
          : isError
            ? 'Food search failed.'
            : options.length > 0
              ? `${options.length} result${options.length === 1 ? '' : 's'} found for "${debouncedQuery}"`
              : `No results found for "${debouncedQuery}"`;

    return (
        <div ref={containerRef} className="relative">
            <Input
                id={id}
                ref={inputRef}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                aria-invalid={ariaInvalid}
                onChange={(event) => {
                    setDismissed(false);
                    onChange(event.target.value);
                }}
                onFocus={() => {
                    setHasFocus(true);
                    setDismissed(false);
                }}
                onBlur={() => {
                    onBlur();
                    // Deferred so a click on an option (options preventDefault their
                    // own mousedown, so this only matters for genuine outside clicks
                    // and things like the "Try again" button) doesn't get raced by a
                    // blur firing first and unmounting the panel out from under it.
                    setTimeout(() => setHasFocus(false), 150);
                }}
                onKeyDown={handleKeyDown}
            />
            <span className="sr-only" role="status" aria-live="polite">
                {liveMessage}
            </span>

            {open && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label="Food search results"
                    className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
                >
                    {showHint && (
                        <p className="px-3.5 py-2.5 text-sm text-muted-foreground">
                            Keep typing — {MIN_QUERY_LENGTH}+ characters to search
                        </p>
                    )}

                    {searchEnabled && isFetching && (
                        <p className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground">
                            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                            Searching…
                        </p>
                    )}

                    {searchEnabled && !isFetching && isError && (
                        <div className="flex flex-col gap-2 px-3.5 py-2.5 text-sm">
                            <p className="flex items-center gap-2 text-muted-foreground">
                                <AlertCircle size={14} strokeWidth={2} className="shrink-0 text-destructive" />
                                Couldn't search the food catalog. You can still enter this item
                                manually below.
                            </p>
                            <button
                                type="button"
                                className="w-fit text-sm font-medium text-primary hover:underline"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => void refetch()}
                            >
                                Try again
                            </button>
                        </div>
                    )}

                    {searchEnabled && !isFetching && !isError && options.length === 0 && (
                        <p className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-muted-foreground">
                            <SearchX size={14} strokeWidth={2} className="shrink-0" />
                            No matches for "{debouncedQuery}" — enter it manually below.
                        </p>
                    )}

                    {searchEnabled && !isFetching && !isError && options.length > 0 && (
                        <ul className="max-h-72 overflow-y-auto py-1">
                            {options.map((item, index) => (
                                <li key={item.fdcId}>
                                    <button
                                        type="button"
                                        id={`${listboxId}-option-${item.fdcId}`}
                                        role="option"
                                        aria-selected={index === activeIndex}
                                        className={cn(
                                            'flex min-h-11 w-full flex-col justify-center gap-0.5 px-3.5 py-2 text-left text-sm transition-colors',
                                            index === activeIndex ? 'bg-secondary' : 'hover:bg-muted',
                                        )}
                                        // mousedown fires before the input's blur, so selection
                                        // survives the timeout above instead of racing it.
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => selectOption(item)}
                                        onMouseEnter={() => setActiveIndex(index)}
                                    >
                                        <span className="font-medium text-foreground">{item.description}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {formatMacroPreview(item)} per 100 g
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

function formatMacroPreview(item: FoodSearchResult): string {
    const parts: string[] = [];
    if (item.caloriesKcal !== null) parts.push(`${String(item.caloriesKcal)} kcal`);
    if (item.proteinGrams !== null) parts.push(`${String(item.proteinGrams)}g protein`);
    if (item.carbGrams !== null) parts.push(`${String(item.carbGrams)}g carbs`);
    if (item.fatGrams !== null) parts.push(`${String(item.fatGrams)}g fat`);
    return parts.length > 0 ? parts.join(' · ') : 'No macro data reported';
}
