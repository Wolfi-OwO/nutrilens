import { useState, useEffect } from 'react';

export function useReducedMotion(): boolean {
    const [reducedMotion, setReducedMotion] = useState<
        boolean
    >(
        // SSR: return false initially so animations render on the server
        typeof window === 'undefined'
            ? false
            : matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    useEffect(() => {
        const mq = matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);

        const listener = () => setReducedMotion(mq.matches);
        mq.addEventListener('change', listener);

        return () => mq.removeEventListener('change', listener);
    }, []);

    return reducedMotion;
}