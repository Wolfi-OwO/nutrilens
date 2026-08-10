import type { Queryable } from '../database/connection.ts';
import { toAuthProviderLink } from '../models/auth-provider.model.ts';
import type { AuthProviderLink, AuthProviderRow, OAuthProviderName } from '../models/auth-provider.model.ts';

export class AuthProviderRepository {
    readonly #db: Queryable;

    /** @param db - The connection (or transaction-scoped client) to query. */
    public constructor(db: Queryable) {
        this.#db = db;
    }

    /**
     * @param provider - Which OAuth provider.
     * @param providerUserId - The provider's own stable account id (never
     *   the email — providers can change a verified email; their internal
     *   id never changes).
     * @returns The linked account, or `undefined` if this provider identity
     *   has never signed in before.
     */
    public async findByProviderUserId(
        provider: OAuthProviderName,
        providerUserId: string,
    ): Promise<AuthProviderLink | undefined> {
        const { rows } = await this.#db.query<AuthProviderRow>(
            'SELECT id, user_id, provider, provider_user_id, created_at FROM auth_providers WHERE provider = $1 AND provider_user_id = $2',
            [provider, providerUserId],
        );
        return rows[0] ? toAuthProviderLink(rows[0]) : undefined;
    }

    /**
     * Links a provider identity to an existing nutrilens account. Throws
     * (Postgres `23505`) if this exact provider+providerUserId is already
     * linked (to this or any other account), or if this user already has
     * this provider linked — see the two UNIQUE constraints in migration 0004.
     *
     * @param input - Which user, which provider, which provider account id.
     * @returns The newly created link.
     */
    public async link(input: {
        userId: string;
        provider: OAuthProviderName;
        providerUserId: string;
    }): Promise<AuthProviderLink> {
        const { rows } = await this.#db.query<AuthProviderRow>(
            `INSERT INTO auth_providers (user_id, provider, provider_user_id)
             VALUES ($1, $2, $3)
             RETURNING id, user_id, provider, provider_user_id, created_at`,
            [input.userId, input.provider, input.providerUserId],
        );
        const row = rows[0];
        if (!row) {
            throw new Error('Insert did not return a row.');
        }
        return toAuthProviderLink(row);
    }
}
