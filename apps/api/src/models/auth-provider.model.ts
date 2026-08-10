import type { DatabaseRow } from '../database/connection.ts';

export type OAuthProviderName = 'github' | 'google' | 'microsoft';

/** The `auth_providers` domain shape — a linked external identity. */
export interface AuthProviderLink {
    id: string;
    userId: string;
    provider: OAuthProviderName;
    providerUserId: string;
    createdAt: Date;
}

/** The raw `auth_providers` table row shape (snake_case columns), as returned by pg. */
export interface AuthProviderRow extends DatabaseRow {
    id: string;
    user_id: string;
    provider: OAuthProviderName;
    provider_user_id: string;
    created_at: Date;
}

/**
 * Maps a raw `auth_providers` row to the domain {@link AuthProviderLink} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toAuthProviderLink(row: AuthProviderRow): AuthProviderLink {
    return {
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        providerUserId: row.provider_user_id,
        createdAt: row.created_at,
    };
}
