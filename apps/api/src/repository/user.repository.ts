import type { Queryable } from '../database/connection.ts';
import { toUser } from '../models/user.model.ts';
import type { User, UserRow } from '../models/user.model.ts';

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
        const { rows } = await this.#db.query<UserRow>(
            'SELECT id, email, password_hash, display_name, role, status, created_at, updated_at FROM users WHERE email = $1',
            [email],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * @param id - The account id.
     * @returns The matching user, or `undefined` if no account exists.
     */
    public async findById(id: string): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(
            'SELECT id, email, password_hash, display_name, role, status, created_at, updated_at FROM users WHERE id = $1',
            [id],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    /**
     * Lists every account. Unpaginated — the admin-facing filters/pagination
     * this will need are a separate, larger piece of work; this is the bare
     * listing UC-60's "admin searches/filters the user list" flow starts from.
     *
     * @returns Every user, oldest first.
     */
    public async listAll(): Promise<User[]> {
        const { rows } = await this.#db.query<UserRow>(
            'SELECT id, email, password_hash, display_name, role, status, created_at, updated_at FROM users ORDER BY created_at',
        );
        return rows.map(toUser);
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
             RETURNING id, email, password_hash, display_name, role, status, created_at, updated_at`,
            [input.email, input.passwordHash ?? null, input.displayName],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toUser(row);
    }
}
