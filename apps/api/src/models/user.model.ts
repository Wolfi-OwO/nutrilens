import type { DatabaseRow } from '../database/connection.ts';

/** The `users` domain shape, as used throughout the application. */
export interface User {
    id: string;
    email: string;
    /** `null` for an OAuth-only account (migration 0004) — never set a password. */
    passwordHash: string | null;
    displayName: string;
    role: 'user' | 'coach' | 'admin';
    status: 'active' | 'suspended' | 'deleted';
    createdAt: Date;
    updatedAt: Date;
    /**
     * Resolved once, here, from the three avatar sources migration 0006
     * added — see {@link toAvatarUrl}'s precedence — never re-derived by a
     * caller. `null` when none of the three is set, in which case the
     * frontend falls back to its own generated-initials avatar.
     */
    avatarUrl: string | null;
    /**
     * Whether `avatar_upload` specifically is set — distinct from
     * `avatarUrl` being non-null, which could instead mean a provider photo.
     * Lets the frontend show "Remove photo" only when there's an upload of
     * the user's own to remove.
     */
    avatarUploaded: boolean;
}

/** The raw `users` table row shape (snake_case columns), as returned by pg. */
export interface UserRow extends DatabaseRow {
    id: string;
    email: string;
    password_hash: string | null;
    display_name: string;
    role: User['role'];
    status: User['status'];
    created_at: Date;
    updated_at: Date;
    // Cheap boolean projections of the bytea columns (migration 0006) —
    // never the bytea itself. Every row shape that goes through toUser()
    // (admin listings, search results, ...) would otherwise pull the actual
    // image bytes on every read; see repository/user.repository.ts's
    // `findAvatarBytes` for the one query allowed to touch them directly.
    has_avatar_upload: boolean;
    avatar_provider_url: string | null;
    has_avatar_provider_image: boolean;
}

/**
 * Precedence: an explicit upload always wins over an imported provider
 * photo; between the two provider sources, a hot-linked URL (GitHub/Google)
 * needs no bytes of our own, while Microsoft's best-effort downloaded bytes
 * (no picture URL exists in its OIDC claims) serve from the same
 * `/users/:id/avatar` endpoint an upload would.
 *
 * @param row - The raw database row.
 * @returns The URL the frontend should render, or `null` for "no avatar —
 *   show the generated-initials fallback".
 */
function toAvatarUrl(row: UserRow): string | null {
    if (row.has_avatar_upload) return `/users/${row.id}/avatar`;
    if (row.avatar_provider_url) return row.avatar_provider_url;
    if (row.has_avatar_provider_image) return `/users/${row.id}/avatar`;
    return null;
}

/**
 * Maps a raw `users` row to the domain {@link User} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toUser(row: UserRow): User {
    return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        displayName: row.display_name,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        avatarUrl: toAvatarUrl(row),
        avatarUploaded: row.has_avatar_upload,
    };
}
