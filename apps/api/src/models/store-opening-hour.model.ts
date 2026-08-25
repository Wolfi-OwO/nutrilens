import type { DatabaseRow } from '../database/connection.ts';

/** The `store_opening_hours` domain shape, as used throughout the application. */
export interface StoreOpeningHour {
    id: string;
    storeId: string;
    /** 0 = Sunday ... 6 = Saturday, matching JS's `Date#getDay()`. */
    dayOfWeek: number;
    /** `HH:MM:SS`, as pg returns a `TIME` column. */
    opensAt: string;
    closesAt: string;
    createdAt: Date;
}

/** The raw `store_opening_hours` table row shape (snake_case columns), as returned by pg. */
export interface StoreOpeningHourRow extends DatabaseRow {
    id: string;
    store_id: string;
    day_of_week: number;
    opens_at: string;
    closes_at: string;
    created_at: Date;
}

/**
 * Maps a raw `store_opening_hours` row to the domain {@link StoreOpeningHour} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toStoreOpeningHour(row: StoreOpeningHourRow): StoreOpeningHour {
    return {
        id: row.id,
        storeId: row.store_id,
        dayOfWeek: row.day_of_week,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        createdAt: row.created_at,
    };
}
