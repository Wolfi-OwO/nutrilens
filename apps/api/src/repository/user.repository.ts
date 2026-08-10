import type { Queryable } from '../database/connection.ts';
import { toUser } from '../models/user.model.ts';
import type { User, UserRow } from '../models/user.model.ts';

const COLUMNS = 'id, email, password_hash, display_name, role, status, created_at, updated_at';

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
}
