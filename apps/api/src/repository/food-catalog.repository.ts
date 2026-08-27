import type { Queryable } from '../database/connection.ts';
import type { FoodCatalogEntry, FoodCatalogRow } from '../models/food-catalog.model.ts';
import { toFoodCatalogEntry } from '../models/food-catalog.model.ts';

const COLUMNS = ['fdc_id', 'description', 'category', 'calories_kcal', 'protein_grams', 'carb_grams', 'fat_grams', 'data_type', 'ean_code', 'created_at', 'updated_at'].join(', ');

/**
 * Every character Postgres' ARE engine treats as syntax. Escaped, not stripped:
 * a user searching for "Milk, reduced fat (2%)" must still find it.
 *
 * `-`, `:`, `=`, `!`, `<` and `>` are only special inside bracket expressions and
 * `(?...)` constraints, which the search query never opens — they are in the set
 * anyway because the cost is one backslash and the cost of being wrong is a 500.
 */
const REGEX_METACHARACTERS = /[-.\\+*?[\]^$(){}=!<>|:]/g;

/** `\`, `%` and `_` — the only three characters LIKE/ILIKE treats as syntax. */
const LIKE_METACHARACTERS = /[\\%_]/g;

/**
 * Neutralise regex syntax in untrusted input so the pattern matches literally.
 *
 * Without this, `q` reaches `~*` as regex SOURCE. Measured against the real
 * 13,588-row catalog: `q=a%(` produced `invalid regular expression: parentheses
 * () not balanced` — an unhandled 500 on an endpoint any logged-in user can hit,
 * driven purely by query text. `q=a%\` (trailing backslash) did the same.
 *
 * Postgres' ARE engine is a hybrid DFA/NFA, so the classic catastrophic-backtracking
 * payloads (`(a|a)*$`, `(a+)+$`) measured flat here (15-20 ms) rather than hanging.
 * The escape is not a bet on that staying true — it removes the class, not the sample.
 *
 * A backslash before a non-alphanumeric is that literal character in ARE, which is
 * why escaping the metacharacter set (rather than everything non-alphanumeric) is
 * both sufficient and safe for non-ASCII input like "Müsli".
 *
 * @param value - Untrusted text destined for a regex operand.
 * @returns The same text, matching literally.
 */
function escapeRegex(value: string): string {
    return value.replace(REGEX_METACHARACTERS, '\\$&');
}

/**
 * Neutralise LIKE/ILIKE wildcards in untrusted input.
 *
 * The decision, recorded because the counter-argument is real ("nobody types `%`
 * into a food search, so why pay for it"): ESCAPE THEM. Two reasons, both measured.
 *
 * 1. Correctness, and this is the stronger one. USDA descriptions contain `%`
 *    literally — "Milk, reduced fat (2%)", "Apple juice, 100%". Unescaped, `q=2%`
 *    is "starts with 2, then anything"; escaped, it is the literal "2%" the user
 *    typed. Escaping makes those queries work, it does not break them.
 * 2. Cost. `EXPLAIN ANALYZE` on the 13,588-row catalog: `q=steak` scans 489 rows,
 *    `q=%%` scans all 13,588 and runs the ORDER BY regex on every one — a 28x
 *    amplification for a two-character query, on an endpoint rate-limited per IP
 *    rather than per unit of work. `q=__` and `q=a%` reproduce it.
 *
 * Relies on the default LIKE escape character (backslash); no ESCAPE clause is
 * needed. The value is bound as a parameter, never interpolated, so there is no
 * SQL-literal layer where `standard_conforming_strings` could double-escape it.
 *
 * @param value - Untrusted text destined for a LIKE/ILIKE pattern.
 * @returns The same text, matching literally.
 */
function escapeLikePattern(value: string): string {
    return value.replace(LIKE_METACHARACTERS, '\\$&');
}

export class FoodCatalogRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * Search for foods by description + category. Ranks by:
     * 1. `, NFS` (Not Further Specified) entries: canonical/generic items.
     * 2. Data type priority (survey_food > foundation_food > sr_legacy).
     *    Prepared dishes are ranked higher for common meal names like "pizza"
     *    and "hamburger", which are more common in survey data.
     * 3. Word-boundary match: "Beef, steak" matches "steak" as a word, not "Steak" embedded in "Pineapple steak sauce".
     * 4. Trigram word_similarity fallback: bridges spelling variants like
     *    "omelette" (query) → "Omelet" (catalog). Threshold 0.65 measured against known pairs:
     *    - "omelette" → "Egg white omelet..." = 0.778 (good, accepted)
     *    - "donuts" → "Doughnuts..." = ~0.8 (good, accepted)
     *    - "spaghetti carbonara" → "spaghetti squash" = 0.55 (bad, rejected)
     *    Only fires if ILIKE returns nothing, preserving performance for
     *    successful matches.
     *
     * Strategy: Two-pass search. First pass uses ILIKE word-boundary matching
     * to catch exact/prefix matches, including common variants (e.g., "doughnut"
     * for "donuts"). If nothing matches (e.g., user typed "omelette", catalog
     * has "Omelet"), second pass uses word_similarity with threshold tuned to
     * accept real spelling variants while rejecting false positives.
     *
     * @param query - The search query (e.g., "steak", "omelette").
     * @param limit - Max results to return.
     * @returns Matching foods, most relevant first.
     */
    public async search(query: string, limit: number): Promise<FoodCatalogEntry[]> {
        // First pass: exact/prefix matching via ILIKE.
        // Case-insensitive substring match. Word-boundary ranking ranks leading
        // matches (e.g., "Beef steak" for query "steak") above mid-string
        // matches (e.g., "Steak sauce" where "steak" is not the leading noun).
        // Two escapes, not one: LIKE and regex have different syntax, so a single
        // escaped form would be wrong in whichever operand it wasn't built for.
        const likeQuery = escapeLikePattern(query);
        const regexQuery = escapeRegex(query);

        const searchPattern = `%${likeQuery}%`;
        const nfsPattern = `%, NFS`;

        // Expand pattern for common spelling variants and multi-word queries
        const whereClause = 'description ILIKE $1 OR category ILIKE $1';
        const params: unknown[] = [searchPattern, nfsPattern, likeQuery, regexQuery];

        // For queries that might have spelling variations, use word_similarity fallback
        // which handles these naturally without special cases
        const orderByClause = `
            -- Rank by word-boundary match (leading noun scores higher).
            -- Query as a separate word (not embedded in another):
            -- "Beef steak" is a word boundary match, "pineapple" is not.
            -- Regex: (^|[^a-z]) before, ([^a-z]|$) after to ensure word boundaries.
            -- $4 is escapeRegex(query), NOT the raw query. Do not "simplify" it back
            -- to $3: the raw query is regex SOURCE here, and q=a%( made this operand
            -- an unbalanced-parentheses error -> unhandled 500. See escapeRegex.
            CASE WHEN description ~* ('(^|[^a-z])' || $4 || '([^a-z]|$)') THEN 0 ELSE 1 END,
            -- Prefer ', NFS' entries (canonical/generic items).
            -- "Beef, steak, NFS" ranks higher than "Steak sauce" because it's the
            -- unqualified/generic version of the food the user asked for.
            CASE WHEN description ILIKE $2 THEN 0 ELSE 1 END,
            -- Prefer survey_food prepared dishes over foundation and sr_legacy
            CASE data_type
                WHEN 'survey_food' THEN 1
                WHEN 'foundation_food' THEN 2
                ELSE 3
            END,
            -- Prefer structured entries with commas (more canonical/formal).
            -- "Pizza, cheese" is more canonical than "Pizza rolls".
            -- "Pie, apple" is more canonical than "Apple pie filling".
            CASE WHEN description LIKE '%,%' THEN 0 ELSE 1 END,
            -- Among non-NFS items, prefer leading matches (starts with query).
            -- "Apple, raw" scores higher than "Pie, apple" for single-word queries.
            -- $3 is escapeLikePattern(query): a LIKE operand, so it needs the LIKE
            -- escape, not the regex one. The trailing '%' is ours and stays a wildcard.
            CASE WHEN LOWER(description) LIKE LOWER($3) || '%' THEN 0 ELSE 1 END,
            -- Tiebreak: prefer shorter descriptions (more canonical/generic).
            -- "Pizza, cheese" ranks higher than "Pizza, cheese, extra toppings".
            LENGTH(description) ASC,
            description ASC`;

        const { rows } = await this.#db.query<FoodCatalogRow>(
            `SELECT ${COLUMNS}
            FROM food_catalog
            WHERE ${whereClause}
            ORDER BY ${orderByClause}
            LIMIT $5
            `,
            [...params, limit],
        );

        // If no results, fall back to trigram similarity. Threshold 0.65 tuned by
        // measuring actual word_similarity values in the live database:
        // - "omelette" → "Egg white omelet..." = 0.778 (✓ pass, correct match)
        // - "donuts" → "Doughnuts..." = ~0.8 (✓ pass, correct match)
        // - "spaghetti carbonara" → "spaghetti squash" = 0.55 (✗ reject, false positive)
        // This rejects unrelated false positives while accepting real spelling variants.
        //
        // Performance: Added $1 <% description to enable GIN index use (idx_food_catalog_trgm).
        // The <% operator uses word_similarity_threshold (0.6 on this DB, confirmed via SHOW).
        // Since 0.6 < 0.65, <% returns a strict superset; the explicit > 0.65 test still
        // decides the final result, preserving semantics while letting the index narrow
        // candidates first. Measured improvement: 791 buffers / 112.9 ms → 4 buffers / 4.2 ms.
        // Do NOT instead SET pg_trgm.word_similarity_threshold: this app uses connection pooling,
        // and non-LOCAL SET statements leak to all later queries on that pooled connection.
        if (rows.length === 0) {
            const { rows: similarRows } = await this.#db.query<FoodCatalogRow>(
                `
                SELECT ${COLUMNS}
                FROM food_catalog
                WHERE $1 <% description AND word_similarity($1, description) > 0.65
                ORDER BY
                    word_similarity($1, description) DESC,
                    CASE data_type
                        WHEN 'survey_food' THEN 1
                        WHEN 'foundation_food' THEN 2
                        ELSE 3
                    END,
                    LENGTH(description) ASC,
                    description ASC
                LIMIT $2
                `,
                // Deliberately the RAW query: word_similarity and <% take plain text,
                // not a pattern, so escaping here would make the user search for
                // backslashes. Nothing to neutralise — there is no syntax to abuse.
                [query, limit],
            );
            return similarRows.map((row) => toFoodCatalogEntry(row));
        }

        return rows.map((row) => toFoodCatalogEntry(row));
    }

    /**
     * @param fdcId - The USDA food ID.
     * @returns The matching food, or `undefined` if no such food exists.
     */
    public async findByFdcId(fdcId: number): Promise<FoodCatalogEntry | undefined> {
        const { rows } = await this.#db.query<FoodCatalogRow>(
            `SELECT ${COLUMNS} FROM food_catalog WHERE fdc_id = $1`,
            [fdcId],
        );
        return rows[0] ? toFoodCatalogEntry(rows[0]) : undefined;
    }

    /**
     * @param eanCode - The EAN-13 or UPC-A barcode to look up.
     * @returns The matching food, or `undefined` if no catalog entry carries this barcode.
     */
    public async findByBarcode(eanCode: string): Promise<FoodCatalogEntry | undefined> {
        const { rows } = await this.#db.query<FoodCatalogRow>(
            `SELECT ${COLUMNS} FROM food_catalog WHERE ean_code = $1`,
            [eanCode],
        );
        return rows[0] ? toFoodCatalogEntry(rows[0]) : undefined;
    }
}
