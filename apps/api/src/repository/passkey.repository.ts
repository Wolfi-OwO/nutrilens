import type { DatabaseRow, Queryable } from '../database/connection.ts';

export interface Passkey {
    id: string;
    userId: string;
    credentialId: string;
    publicKey: Uint8Array;
    counter: number;
    transports: string[];
    deviceType: string;
    backedUp: boolean;
    name: string;
    createdAt: Date;
    lastUsedAt: Date | null;
}

interface PasskeyRow extends DatabaseRow {
    id: string;
    user_id: string;
    credential_id: string;
    public_key: Buffer;
    counter: string | number;
    transports: string[];
    device_type: string;
    backed_up: boolean;
    name: string;
    created_at: Date;
    last_used_at: Date | null;
}

const COLUMNS =
    'id, user_id, credential_id, public_key, counter, transports, device_type, backed_up, name, created_at, last_used_at';

function toPasskey(row: PasskeyRow): Passkey {
    return {
        id: row.id,
        userId: row.user_id,
        credentialId: row.credential_id,
        publicKey: new Uint8Array(row.public_key),
        counter: Number(row.counter),
        transports: row.transports,
        deviceType: row.device_type,
        backedUp: row.backed_up,
        name: row.name,
        createdAt: row.created_at,
        lastUsedAt: row.last_used_at,
    };
}

/** Stored passkeys and the short-lived WebAuthn ceremonies that create or use them. */
export class PasskeyRepository {
    readonly #db: Queryable;

    public constructor(db: Queryable) {
        this.#db = db;
    }

    public async listByUser(userId: string): Promise<Passkey[]> {
        const { rows } = await this.#db.query<PasskeyRow>(
            `SELECT ${COLUMNS} FROM passkeys WHERE user_id = $1 ORDER BY created_at`,
            [userId],
        );
        return rows.map(toPasskey);
    }

    public async findByCredentialId(credentialId: string): Promise<Passkey | null> {
        const { rows } = await this.#db.query<PasskeyRow>(
            `SELECT ${COLUMNS} FROM passkeys WHERE credential_id = $1`,
            [credentialId],
        );
        return rows[0] ? toPasskey(rows[0]) : null;
    }

    public async create(input: Omit<Passkey, 'id' | 'createdAt' | 'lastUsedAt'>): Promise<Passkey> {
        const { rows } = await this.#db.query<PasskeyRow>(
            `INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLUMNS}`,
            [
                input.userId,
                input.credentialId,
                Buffer.from(input.publicKey),
                input.counter,
                input.transports,
                input.deviceType,
                input.backedUp,
                input.name,
            ],
        );
        return toPasskey(rows[0] as PasskeyRow);
    }

    /** Records a use: the counter some authenticators advance, and when. */
    public async touch(id: string, counter: number): Promise<void> {
        await this.#db.query(
            'UPDATE passkeys SET counter = $2, last_used_at = now() WHERE id = $1',
            [id, counter],
        );
    }

    /** @returns Whether a passkey of that user was removed. */
    public async remove(userId: string, id: string): Promise<boolean> {
        const { rowCount } = await this.#db.query(
            'DELETE FROM passkeys WHERE id = $1 AND user_id = $2',
            [id, userId],
        );
        return (rowCount ?? 0) > 0;
    }

    public async saveChallenge(
        challenge: string,
        purpose: 'register' | 'login',
        userId: string | null,
        ttlSeconds: number,
    ): Promise<string> {
        // Expired ceremonies are swept on the way in, so the table cannot grow.
        await this.#db.query('DELETE FROM webauthn_challenges WHERE expires_at < now()');
        const { rows } = await this.#db.query<{ id: string } & DatabaseRow>(
            `INSERT INTO webauthn_challenges (challenge, purpose, user_id, expires_at)
             VALUES ($1, $2, $3, now() + make_interval(secs => $4)) RETURNING id`,
            [challenge, purpose, userId, ttlSeconds],
        );
        return (rows[0] as { id: string }).id;
    }

    /** Takes a challenge exactly once: a replayed response finds nothing. */
    public async takeChallenge(
        id: string,
        purpose: 'register' | 'login',
    ): Promise<{ challenge: string; userId: string | null } | null> {
        const { rows } = await this.#db.query<
            { challenge: string; user_id: string | null } & DatabaseRow
        >(
            `DELETE FROM webauthn_challenges
             WHERE id = $1 AND purpose = $2 AND expires_at > now()
             RETURNING challenge, user_id`,
            [id, purpose],
        );
        const row = rows[0];
        return row ? { challenge: row.challenge, userId: row.user_id } : null;
    }
}
