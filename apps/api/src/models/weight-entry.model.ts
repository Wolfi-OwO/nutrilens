import type { DatabaseRow } from '../database/connection.ts';

/** The `weight_entries` domain shape, as used throughout the application. */
export interface WeightEntry {
    id: string;
    userId: string;
    weightKg: number;
    recordedAt: Date;
    createdAt: Date;
}

/** The raw `weight_entries` table row shape (snake_case columns), as returned by pg. */
export interface WeightEntryRow extends DatabaseRow {
    id: string;
    user_id: string;
    weight_kg: number;
    recorded_at: Date;
    created_at: Date;
}

/**
 * Maps a raw `weight_entries` row to the domain {@link WeightEntry} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toWeightEntry(row: WeightEntryRow): WeightEntry {
    return {
        id: row.id,
        userId: row.user_id,
        weightKg: row.weight_kg,
        recordedAt: row.recorded_at,
        createdAt: row.created_at,
    };
}
