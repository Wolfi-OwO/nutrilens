import type { Queryable } from '../database/connection.ts';
import { toUser } from '../models/user.model.ts';
import type { User, UserRow } from '../models/user.model.ts';

const COLUMNS =
    'id, email, password_hash, display_name, role, status, created_at, updated_at, ' +
    '(avatar_upload IS NOT NULL) AS has_avatar_upload, avatar_provider_url, ' +
    '(avatar_provider_image IS NOT NULL) AS has_avatar_provider_image';

export interface SearchUsersFilters {
    /** Matches against email or display name (case-insensitive, substring). */
    q?: string | undefined;
    role?: User['role'] | undefined;
    status?: User['status'] | undefined;
    /** 1-indexed. */
    page: number;
    pageSize: number;
}

export interface SearchUsersResult {
    users: User[];
    total: number;
}

export interface UpdateRoleStatusInput {
    role?: User['role'] | undefined;
    status?: User['status'] | undefined;
}

export interface UserDataExport {
    user: Omit<User, 'passwordHash'>;
    oauthProviders: Array<{ provider: string; providerUserId: string }>;
    dietPlans: Array<{
        id: string;
        dailyCalorieTarget: number;
        proteinTargetGrams: number;
        carbTargetGrams: number;
        fatTargetGrams: number;
        goal: string;
        startsAt: Date;
        endsAt: Date | null;
        createdAt: Date;
    }>;
    mealLogs: Array<{
        id: string;
        dietPlanId: string;
        source: string;
        loggedAt: Date;
        totalCalories: number;
        proteinGrams: number;
        carbGrams: number;
        fatGrams: number;
        userCorrected: boolean;
        createdAt: Date;
        items: Array<{
            id: string;
            foodName: string;
            portionGrams: number;
            confidence: number;
            calories: number;
            createdAt: Date;
        }>;
    }>;
    weightEntries: Array<{
        id: string;
        weightKg: number;
        recordedAt: Date;
        recordedDate: string;
        createdAt: Date;
    }>;
}

export class UserRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param email - The address to look up (case-insensitive, per the
     *   `CITEXT` column type).
     * @returns The matching user, or `undefined` if no account exists.
     */
    public async findByEmail(email: string): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [email]);
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * @param id - The account id.
     * @returns The matching user, or `undefined` if no account exists.
     */
    public async findById(id: string): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * The admin user-listing query behind UC-63 (#100) — search + filter +
     * pagination in one query, with the total match count carried alongside
     * each row via `count(*) OVER()` rather than a second round trip.
     *
     * @param filters - Search term, role/status filters, and page/pageSize
     *   (both already validated and capped — see `schemas/users.schemas.ts`).
     * @returns The matching page of users, plus the total match count across
     *   all pages.
     */
    public async search(filters: SearchUsersFilters): Promise<SearchUsersResult> {
        const conditions: string[] = [];
        const values: unknown[] = [];

        if (filters.q) {
            values.push(`%${filters.q}%`);
            conditions.push(`(email ILIKE $${String(values.length)} OR display_name ILIKE $${String(values.length)})`);
        }
        if (filters.role) {
            values.push(filters.role);
            conditions.push(`role = $${String(values.length)}`);
        }
        if (filters.status) {
            values.push(filters.status);
            conditions.push(`status = $${String(values.length)}`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        values.push(filters.pageSize);
        const limitParam = values.length;
        values.push((filters.page - 1) * filters.pageSize);
        const offsetParam = values.length;

        const { rows } = await this.#db.query<UserRow & { total_count: string }>(
            `SELECT ${COLUMNS}, count(*) OVER() AS total_count
             FROM users
             ${where}
             ORDER BY created_at DESC
             LIMIT $${String(limitParam)} OFFSET $${String(offsetParam)}`,
            values,
        );

        return {
            users: rows.map(toUser),
            total: rows[0] ? Number(rows[0].total_count) : 0,
        };
    }

    /**
     * The last-admin guard's count (#101, `organizational/access-control.md`).
     *
     * @param excludingUserId - Excludes this id from the count — the guard
     *   asks "would zero *other* active admins remain," not "are there
     *   zero active admins right now" (the target row's own current state
     *   would otherwise always count itself).
     * @returns The number of active admins, not counting `excludingUserId`.
     */
    public async countActiveAdmins(excludingUserId: string): Promise<number> {
        const { rows } = await this.#db.query<{ count: string }>(
            `SELECT count(*) AS count FROM users WHERE role = 'admin' AND status = 'active' AND id != $1`,
            [excludingUserId],
        );
        return Number(rows[0]?.count ?? 0);
    }

    /**
     * Applies a role and/or status change (#101). Whichever field is
     * omitted keeps its current value — this is a partial update, not a
     * full replace.
     *
     * @param id - The account id.
     * @param fields - The field(s) to change.
     * @returns The updated user, or `undefined` if no account with `id` exists.
     */
    public async updateRoleStatus(id: string, fields: UpdateRoleStatusInput): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(
            `UPDATE users
             SET role = COALESCE($2, role), status = COALESCE($3, status), updated_at = now()
             WHERE id = $1
             RETURNING ${COLUMNS}`,
            [id, fields.role ?? null, fields.status ?? null],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * Inserts a new user row. Throws (with Postgres error code `23505`) if
     * `input.email` already exists — see `users.email`'s UNIQUE constraint.
     *
     * @param input - The fields required to create an account.
     *   `passwordHash` is omitted (not just falsy) for an OAuth-only
     *   account — see migration 0004.
     * @returns The newly created user.
     */
    public async create(input: {
        email: string;
        passwordHash?: string;
        displayName: string;
    }): Promise<User> {
        const { rows } = await this.#db.query<UserRow>(
            `INSERT INTO users (email, password_hash, display_name)
             VALUES ($1, $2, $3)
             RETURNING ${COLUMNS}`,
            [input.email, input.passwordHash ?? null, input.displayName],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toUser(row);
    }

    /**
     * Self-service profile edit (`PATCH /users/me`) — `displayName` is the
     * only field editable through this path; email/role/status stay
     * read-only here on purpose (see UserService.updateProfile).
     *
     * @param id - The account id.
     * @param displayName - The new display name (already trimmed/validated).
     * @returns The updated user, or `undefined` if no account with `id` exists.
     */
    public async updateDisplayName(id: string, displayName: string): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(
            `UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
            [id, displayName],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * Sets the caller's own uploaded avatar (already normalized to webp by
     * `lib/normalize-avatar.ts` — this method just persists the bytes).
     * Always wins over a provider-sourced avatar — see
     * `user.model.ts`'s `toAvatarUrl`.
     *
     * @param id - The account id.
     * @param bytes - The normalized image bytes.
     * @returns The updated user, or `undefined` if no account with `id` exists.
     */
    public async setAvatarUpload(id: string, bytes: Buffer): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(
            `UPDATE users SET avatar_upload = $2, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
            [id, bytes],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * Removes the caller's own uploaded avatar. Deliberately never touches
     * `avatar_provider_url`/`avatar_provider_image` — removing a manual
     * upload should reveal a still-linked provider photo, not jump straight
     * to the frontend's generated-initials fallback.
     *
     * @param id - The account id.
     * @returns The updated user, or `undefined` if no account with `id` exists.
     */
    public async clearAvatarUpload(id: string): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(
            `UPDATE users SET avatar_upload = NULL, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
            [id],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * Records a GitHub/Google avatar URL captured on OAuth login
     * (`OAuthService#captureProviderAvatar`). Fire-and-forget — no
     * `RETURNING`, since this runs from the login path, not a request that
     * returns the row — and never called with an empty value: a provider
     * outage on a later login must not erase a previously captured photo.
     *
     * @param id - The account id.
     * @param url - The provider's own hosted avatar URL, stored verbatim.
     */
    public async setProviderAvatarUrl(id: string, url: string): Promise<void> {
        await this.#db.query('UPDATE users SET avatar_provider_url = $2 WHERE id = $1', [id, url]);
    }

    /**
     * Records Microsoft's best-effort Graph photo, already normalized to
     * webp by the caller. See {@link setProviderAvatarUrl} for the
     * fire-and-forget/never-null rationale, which applies the same way here.
     *
     * @param id - The account id.
     * @param bytes - The normalized image bytes.
     */
    public async setProviderAvatarImage(id: string, bytes: Buffer): Promise<void> {
        await this.#db.query('UPDATE users SET avatar_provider_image = $2 WHERE id = $1', [id, bytes]);
    }

    /**
     * The `GET /users/:id/avatar` handler's backing query — the *only*
     * query in this repository allowed to touch the bytea avatar columns
     * directly (every other query only ever selects the cheap boolean
     * projections — see `COLUMNS`).
     *
     * @param id - The account id.
     * @returns The raw image bytes to serve (upload takes precedence over
     *   a Microsoft-provider image — see `user.model.ts`'s `toAvatarUrl`
     *   for why both resolve to this same endpoint), or `undefined` if
     *   neither is set (or the account doesn't exist).
     */
    public async findAvatarBytes(id: string): Promise<Buffer | undefined> {
        const { rows } = await this.#db.query<{ bytes: Buffer | null }>(
            'SELECT COALESCE(avatar_upload, avatar_provider_image) AS bytes FROM users WHERE id = $1',
            [id],
        );
        return rows[0]?.bytes ?? undefined;
    }

    /**
     * Deletes a user account and all related data (diet plans, meal logs,
     * weight entries, OAuth provider links). Called inside a transaction
     * by UserService.deleteAccount to ensure cascade consistency.
     *
     * @param id - The account id to delete.
     * @returns Whether a user with that id existed.
     */
    public async deleteById(id: string): Promise<boolean> {
        const { rows } = await this.#db.query<{ id: string }>(
            'DELETE FROM users WHERE id = $1 RETURNING id',
            [id],
        );
        return rows.length > 0;
    }

    /**
     * Fetches all data belonging to a user (GDPR Art. 20 — data portability).
     * Includes profile, linked OAuth providers, diet plans, meal logs with items,
     * and weight entries. Password hash is deliberately excluded.
     *
     * @param userId - The user whose data to export.
     * @returns The user's data or undefined if the account doesn't exist.
     */
    public async exportUserData(userId: string): Promise<UserDataExport | undefined> {
        // Fetch user — guard against nonexistent id.
        const { rows: userRows } = await this.#db.query<UserRow>(
            `SELECT ${COLUMNS} FROM users WHERE id = $1`,
            [userId],
        );
        if (!userRows[0]) {
            return undefined;
        }
        const user = toUser(userRows[0]);
        const publicUser = { ...user };
        delete (publicUser as Record<string, unknown>)['passwordHash'];

        // Fetch OAuth providers linked to this user.
        const { rows: providerRows } = await this.#db.query<{
            provider: string;
            provider_user_id: string;
        }>(
            `SELECT provider, provider_user_id FROM auth_providers
             WHERE user_id = $1
             ORDER BY created_at ASC`,
            [userId],
        );

        // Fetch diet plans belonging to this user.
        const { rows: planRows } = await this.#db.query<{
            id: string;
            daily_calorie_target: number;
            protein_target_grams: number;
            carb_target_grams: number;
            fat_target_grams: number;
            goal: string;
            starts_at: Date;
            ends_at: Date | null;
            created_at: Date;
        }>(
            `SELECT id, daily_calorie_target, protein_target_grams,
                    carb_target_grams, fat_target_grams, goal,
                    starts_at, ends_at, created_at
             FROM diet_plans
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId],
        );

        // Fetch meal logs and their items.
        const { rows: logRows } = await this.#db.query<{
            id: string;
            diet_plan_id: string;
            source: string;
            logged_at: Date;
            total_calories: number;
            protein_grams: number;
            carb_grams: number;
            fat_grams: number;
            user_corrected: boolean;
            created_at: Date;
        }>(
            `SELECT id, diet_plan_id, source, logged_at, total_calories,
                    protein_grams, carb_grams, fat_grams, user_corrected, created_at
             FROM meal_logs
             WHERE user_id = $1
             ORDER BY logged_at DESC`,
            [userId],
        );

        // Fetch all meal log items for all of this user's logs in one query.
        const { rows: itemRows } = await this.#db.query<{
            meal_log_id: string;
            id: string;
            food_name: string;
            portion_grams: number;
            confidence: number;
            calories: number;
            created_at: Date;
        }>(
            `SELECT meal_log_id, id, food_name, portion_grams, confidence, calories, created_at
             FROM meal_log_items
             WHERE meal_log_id = ANY(
                 SELECT id FROM meal_logs WHERE user_id = $1
             )
             ORDER BY created_at ASC`,
            [userId],
        );

        // Group items by meal_log_id.
        const itemsByLogId = new Map<
            string,
            Array<{
                id: string;
                foodName: string;
                portionGrams: number;
                confidence: number;
                calories: number;
                createdAt: Date;
            }>
        >();
        for (const item of itemRows) {
            const logId = item.meal_log_id;
            if (!itemsByLogId.has(logId)) {
                itemsByLogId.set(logId, []);
            }
            itemsByLogId.get(logId)!.push({
                id: item.id,
                foodName: item.food_name,
                portionGrams: item.portion_grams,
                confidence: item.confidence,
                calories: item.calories,
                createdAt: item.created_at,
            });
        }

        // Construct meal logs with their items.
        const mealLogs = logRows.map((log) => ({
            id: log.id,
            dietPlanId: log.diet_plan_id,
            source: log.source,
            loggedAt: log.logged_at,
            totalCalories: log.total_calories,
            proteinGrams: log.protein_grams,
            carbGrams: log.carb_grams,
            fatGrams: log.fat_grams,
            userCorrected: log.user_corrected,
            createdAt: log.created_at,
            items: itemsByLogId.get(log.id) ?? [],
        }));

        // Fetch weight entries.
        const { rows: weightRows } = await this.#db.query<{
            id: string;
            weight_kg: number;
            recorded_at: Date;
            recorded_date: string;
            created_at: Date;
        }>(
            `SELECT id, weight_kg, recorded_at, recorded_date, created_at
             FROM weight_entries
             WHERE user_id = $1
             ORDER BY recorded_at DESC`,
            [userId],
        );

        return {
            user: publicUser,
            oauthProviders: providerRows.map((p) => ({
                provider: p.provider,
                providerUserId: p.provider_user_id,
            })),
            dietPlans: planRows.map((p) => ({
                id: p.id,
                dailyCalorieTarget: p.daily_calorie_target,
                proteinTargetGrams: p.protein_target_grams,
                carbTargetGrams: p.carb_target_grams,
                fatTargetGrams: p.fat_target_grams,
                goal: p.goal,
                startsAt: p.starts_at,
                endsAt: p.ends_at,
                createdAt: p.created_at,
            })),
            mealLogs,
            weightEntries: weightRows.map((w) => ({
                id: w.id,
                weightKg: w.weight_kg,
                recordedAt: w.recorded_at,
                recordedDate: w.recorded_date,
                createdAt: w.created_at,
            })),
        };
    }
}
