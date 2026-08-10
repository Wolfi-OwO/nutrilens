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
    };
}
