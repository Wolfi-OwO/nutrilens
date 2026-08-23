import { useEffect, useState } from 'react';

// Same shape as lib/reduced-motion.ts's useReducedMotion — a live
// matchMedia subscription, not a one-off read. Used to pick between a
// table and a card layout at runtime rather than toggling both with a CSS
// display:none pair: two structurally different renderings of the same
// data (a <table> vs stacked <div>s) both landing in the DOM, one merely
// hidden, doubles every row's accessible text — real assistive-tech and
// automated-testing tools (including this repo's own e2e specs, which use
// exact-text locators) then see the same string twice and can't
// disambiguate. Rendering only the active layout avoids that outright.
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(
        typeof window === 'undefined' ? false : window.matchMedia(query).matches,
    );

    useEffect(() => {
        const mq = window.matchMedia(query);
        setMatches(mq.matches);

        const listener = () => {
            setMatches(mq.matches);
        };
        mq.addEventListener('change', listener);

        return () => {
            mq.removeEventListener('change', listener);
        };
    }, [query]);

    return matches;
}
