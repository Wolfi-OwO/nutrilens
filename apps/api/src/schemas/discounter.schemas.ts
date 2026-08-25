import { z } from 'zod';

/** The five discounters this app currently tracks (issue #184). Mirrors {@link DiscounterCode}. */
export const discounterCodeSchema = z.enum(['spar', 'billa', 'hofer', 'lidl', 'penny']);

// Structural validation only — which fields are actually editable lives in
// DiscounterRepository#update (code/name/countryCode identify the
// discounter and aren't updatable through this shape).
export const updateDiscounterBodySchema = z.object({
    websiteUrl: z.url().nullable().optional(),
    apiEndpoint: z.url().nullable().optional(),
    dataRefreshFrequencyDays: z.number().int().positive().optional(),
});
