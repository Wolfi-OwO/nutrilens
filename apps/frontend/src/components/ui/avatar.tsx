import { useState } from 'react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api-client';

// Reuses the app's own palette hues (accent amber, success green, and the
// three chart-ink hues) rather than inventing new ones, so a generated
// avatar reads as part of the same system instead of a random color. Fixed
// at L 0.42 / C 0.1 below (not --primary's near-black, which would make
// every fallback avatar look identical) — that lightness/chroma combo was
// checked at each hue against white text and clears 4.5:1 in every case
// (worst case, the teal/chart-fat hue at 195deg, still landed at 7.3:1).
const AVATAR_HUES = [45, 145, 260, 80, 195, 28];

function hashToIndex(seed: string, length: number): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % length;
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-11 w-11 text-base',
    // Profile-page hero avatar only — every other usage stays sm/md/lg.
    xl: 'h-24 w-24 text-2xl',
} as const;

interface AvatarProps {
    name: string;
    seed?: string;
    src?: string | null;
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
}

export function Avatar({ name, seed, src, size = 'md', className }: AvatarProps) {
    const [errored, setErrored] = useState(false);

    // A stale/expired provider URL (revoked GitHub avatar, private-account
    // 404, ...) must fall back to the generated initials below rather than
    // breaking the UI — onError flips this to true, replacing the <img>.
    if (src && !errored) {
        return (
            <img
                src={new URL(src, API_BASE_URL).toString()}
                alt={name}
                onError={() => setErrored(true)}
                className={cn('shrink-0 rounded-full object-cover', SIZE_CLASSES[size], className)}
            />
        );
    }

    const hue = AVATAR_HUES[hashToIndex(seed ?? name, AVATAR_HUES.length)];

    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
                SIZE_CLASSES[size],
                className,
            )}
            style={{ backgroundColor: `oklch(0.42 0.1 ${hue})` }}
            aria-hidden="true"
        >
            {initials(name)}
        </span>
    );
}
