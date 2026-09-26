import { z } from 'zod';

/**
 * Every `:id` in this API is a Postgres `uuid` column. Without this, a
 * non-UUID id reached the repository verbatim and Postgres rejected it
 * (SQLSTATE 22P02) — surfacing as a 500 with the raw driver message
 * ("invalid input syntax for type uuid") outside production, on routes
 * including the unauthenticated `GET /users/:id/avatar`. A malformed id is
 * a client error, and the shape check belongs at the edge like every other
 * one (see middlewares/validate.ts).
 */
export const idParamSchema = z.object({
    id: z.uuid(),
});
