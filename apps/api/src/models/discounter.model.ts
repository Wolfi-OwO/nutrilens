import type { DatabaseRow } from '../database/connection.ts';

/** The five discounters this app currently tracks (issue #184). */
export type DiscounterCode = 'spar' | 'billa' | 'hofer' | 'lidl' | 'penny';

/** The `discounters` domain shape, as used throughout the application. */
export interface Discounter {
    id: string;
    code: DiscounterCode;
    name: string;
    countryCode: string;
    websiteUrl: string | null;
    apiEndpoint: string | null;
    dataRefreshFrequencyDays: number;
    createdAt: Date;
    updatedAt: Date;
}

/** The raw `discounters` table row shape (snake_case columns), as returned by pg. */
export interface DiscounterRow extends DatabaseRow {
    id: string;
    code: DiscounterCode;
    name: string;
    country_code: string;
    website_url: string | null;
    api_endpoint: string | null;
    data_refresh_frequency_days: number;
    created_at: Date;
    updated_at: Date;
}

/**
 * Maps a raw `discounters` row to the domain {@link Discounter} shape.
 *
 * @param row - The raw database row.
 * @returns The mapped domain object.
 */
export function toDiscounter(row: DiscounterRow): Discounter {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        countryCode: row.country_code,
        websiteUrl: row.website_url,
        apiEndpoint: row.api_endpoint,
        dataRefreshFrequencyDays: row.data_refresh_frequency_days,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
