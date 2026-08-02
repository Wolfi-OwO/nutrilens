import type { DatabaseRow, Queryable } from '../db/connection-pool.ts';

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    displayName: string;
    role: 'user' | 'coach' | 'admin';
    status: 'active' | 'suspended' | 'deleted';
    createdAt: Date;
    updatedAt: Date;
}

interface UserRow extends DatabaseRow {
    id: string;
    email: string;
    password_hash: string;
    display_name: string;
    role: User['role'];
    status: User['status'];
    created_at: Date;
    updated_at: Date;
}

function toUser(row: UserRow): User {
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

export class UserRepository {
    readonly #db: Queryable;

    public constructor(db: Queryable) {
        this.#db = db;
    }

    public async findByEmail(email: string): Promise<User | undefined> {
        const { rows } = await this.#db.query<UserRow>(
            'SELECT id, email, password_hash, display_name, role, status, created_at, updated_at FROM users WHERE email = $1',
            [email],
        );
        return rows[0] ? toUser(rows[0]) : undefined;
    }

    public async create(input: {
        email: string;
        passwordHash: string;
        displayName: string;
    }): Promise<User> {
        const { rows } = await this.#db.query<UserRow>(
            `INSERT INTO users (email, password_hash, display_name)
             VALUES ($1, $2, $3)
             RETURNING id, email, password_hash, display_name, role, status, created_at, updated_at`,
            [input.email, input.passwordHash, input.displayName],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toUser(row);
    }
}
