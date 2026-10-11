import type { DatabaseRow, Queryable } from '../database/connection.ts';

export interface TotpRecord {
    secretEncrypted: string;
    enabled: boolean;
    recoveryHashes: string[];
}

interface TotpRow extends DatabaseRow {
    secret_encrypted: string;
    enabled: boolean;
    recovery_hashes: string[];
}

/** Persistence for the `user_totp` table (migration 0017). */
export class TotpRepository {
    readonly #db: Queryable;

    public constructor(db: Queryable) {
        this.#db = db;
    }

    public async find(userId: string): Promise<TotpRecord | null> {
        const { rows } = await this.#db.query<TotpRow>(
            'SELECT secret_encrypted, enabled, recovery_hashes FROM user_totp WHERE user_id = $1',
            [userId],
        );
        const row = rows[0];
        return row
            ? { secretEncrypted: row.secret_encrypted, enabled: row.enabled, recoveryHashes: row.recovery_hashes }
            : null;
    }

    /** Stores a pending (not yet enabled) secret, replacing any earlier unconfirmed one. */
    public async savePending(userId: string, secretEncrypted: string): Promise<void> {
        await this.#db.query(
            `INSERT INTO user_totp (user_id, secret_encrypted, enabled, recovery_hashes)
             VALUES ($1, $2, false, '{}')
             ON CONFLICT (user_id) DO UPDATE
               SET secret_encrypted = EXCLUDED.secret_encrypted, enabled = false, recovery_hashes = '{}', enabled_at = NULL
               WHERE user_totp.enabled = false`,
            [userId, secretEncrypted],
        );
    }

    public async enable(userId: string, recoveryHashes: string[]): Promise<void> {
        await this.#db.query(
            'UPDATE user_totp SET enabled = true, enabled_at = now(), recovery_hashes = $2 WHERE user_id = $1',
            [userId, recoveryHashes],
        );
    }

    /** Removes a recovery hash; returns false if it was already used (or never existed). */
    public async consumeRecoveryHash(userId: string, hash: string): Promise<boolean> {
        const { rowCount } = await this.#db.query(
            'UPDATE user_totp SET recovery_hashes = array_remove(recovery_hashes, $2) WHERE user_id = $1 AND $2 = ANY(recovery_hashes)',
            [userId, hash],
        );
        return (rowCount ?? 0) > 0;
    }

    public async remove(userId: string): Promise<void> {
        await this.#db.query('DELETE FROM user_totp WHERE user_id = $1', [userId]);
    }
}
