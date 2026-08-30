// Where the user shops, remembered on this device.
//
// WHY LOCALSTORAGE AND NOT THE API — `meal_logs` has no column for a shop
// (migrations 0001–0016; see the model in apps/api/src/models/meal-log.model.ts),
// and POST /meal-logs would silently drop an extra body field: createMealLogBodySchema
// is a plain z.object, so an unknown key is stripped, not rejected. Sending one
// would look like it saved and lose it. Until that column exists, the selection
// lives here and the UI says so out loud rather than implying a server round-trip.
//
// Namespace matches the app's other keys: nutrilens.token, nutrilens.water.

const STORAGE_KEY = 'nutrilens.shop';

/** How many chains the "recently used" section can surface. Three keeps it a shortcut, not a second list. */
const MAX_RECENT_CHAINS = 3;

/**
 * A shop the user says they bought at. `storeId`/`storeLabel` are optional
 * because the chain alone is a complete answer — "bei Billa" is what he knows;
 * which of 1,067 branches is a detail he may not care to pick.
 */
export interface ShopSelection {
    chainCode: string;
    chainName: string;
    storeId?: string;
    storeLabel?: string;
}

interface ShopMemory {
    /** The last shop confirmed with a meal, pre-filled next time. Null once explicitly cleared. */
    last: ShopSelection | null;
    /** Chain codes, most recently used first — what surfaces above the full 31-chain list. */
    recentChains: string[];
}

const EMPTY: ShopMemory = { last: null, recentChains: [] };

// localStorage is user-writable, so this is a real trust boundary, not a
// formality: another tab, an extension or a hand-edited value can put anything
// under this key. Every field is checked before use — the dashboard's water
// counter reads its own key with a bare JSON.parse and would white-screen the
// page on a corrupt value, which is exactly the failure being avoided here.
function isSelection(value: unknown): value is ShopSelection {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.chainCode !== 'string' || candidate.chainCode.length === 0) return false;
    if (typeof candidate.chainName !== 'string' || candidate.chainName.length === 0) return false;
    if (candidate.storeId !== undefined && typeof candidate.storeId !== 'string') return false;
    if (candidate.storeLabel !== undefined && typeof candidate.storeLabel !== 'string')
        return false;
    return true;
}

/**
 * @returns The remembered shop and recent chains. Always a usable value —
 *   a missing, unparseable or malformed record reads as "nothing remembered",
 *   which is the same thing a first-time user sees.
 */
export function readShopMemory(): ShopMemory {
    if (typeof window === 'undefined') return EMPTY;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return EMPTY;
        const record = parsed as Record<string, unknown>;
        return {
            last: isSelection(record.last) ? record.last : null,
            recentChains: Array.isArray(record.recentChains)
                ? record.recentChains
                      .filter((code): code is string => typeof code === 'string')
                      .slice(0, MAX_RECENT_CHAINS)
                : [],
        };
    } catch {
        return EMPTY;
    }
}

/**
 * Records the shop a meal was confirmed with.
 *
 * @param selection - The confirmed shop, or null when the user deliberately
 *   logged a meal without one. Null clears the pre-fill but KEEPS the recent
 *   chains: "not this time" is not "forget where I shop".
 */
export function rememberShop(selection: ShopSelection | null): void {
    if (typeof window === 'undefined') return;
    const current = readShopMemory();
    const recentChains = selection
        ? [
              selection.chainCode,
              ...current.recentChains.filter((code) => code !== selection.chainCode),
          ].slice(0, MAX_RECENT_CHAINS)
        : current.recentChains;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ last: selection, recentChains }));
    } catch {
        // Private-browsing quota or a blocked storage partition. A forgotten
        // preference is not worth failing a logged meal over, so this is swallowed
        // on purpose — the selection the user made still went through the form.
    }
}
