import type { OAuthProfile } from '../lib/oauth-providers.ts';
import { BadRequestError, ConflictError } from '../lib/errors.ts';
import type { OAuthProviderName } from '../models/auth-provider.model.ts';
import type { PublicUser } from './user-service.ts';
import type { AuthProviderRepository } from '../repository/auth-provider.repository.ts';
import type { UserRepository } from '../repository/user.repository.ts';

/** Postgres unique_violation — see https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
}

function toPublicUser<T extends { passwordHash: string | null }>(user: T): Omit<T, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
}

export class OAuthService {
    readonly #users: UserRepository;
    readonly #authProviders: AuthProviderRepository;

    public constructor(users: UserRepository, authProviders: AuthProviderRepository) {
        this.#users = users;
        this.#authProviders = authProviders;
    }

    /**
     * Resolves a verified provider profile to a nutrilens account — an
     * existing link, a newly linked existing account (matched by verified
     * email only), or a brand-new account.
     *
     * @param provider - Which OAuth provider this profile came from.
     * @param profile - The normalized profile from that provider.
     * @returns The resolved account, without its password hash.
     * @throws {BadRequestError} If the provider never returned an email at
     *   all (some GitHub accounts can hide every address) — nutrilens has no
     *   passwordless-and-emailless account concept, there's nowhere to send
     *   this login.
     */
    public async resolveAccount(provider: OAuthProviderName, profile: OAuthProfile): Promise<PublicUser> {
        const existingLink = await this.#authProviders.findByProviderUserId(provider, profile.providerUserId);
        if (existingLink) {
            const user = await this.#users.findById(existingLink.userId);
            if (!user) {
                throw new Error(`auth_providers row references a deleted user (id ${existingLink.userId}).`);
            }
            return toPublicUser(user);
        }

        if (!profile.email) {
            throw new BadRequestError(
                `Your ${provider} account has no accessible email address, so nutrilens can't create an account from it. Try a provider that shares your email, or register with email/password.`,
            );
        }

        // Only a *verified* email is safe to merge into an existing account —
        // an attacker who controls an unverified address on provider A could
        // otherwise take over a victim's existing nutrilens account created
        // with that same email via provider B or email/password. This
        // matters for BOTH branches below: the up-front lookup only runs
        // when verified, and — just as important — the unique_violation
        // recovery path when creating a new user must not treat "this email
        // is already taken" as an innocent race to silently link past when
        // the email was never verified. That was a real bug here once,
        // caught by a test with this exact shape (unverified email
        // colliding with a pre-existing account must be rejected outright).
        if (profile.emailVerified) {
            const existingUser = await this.#users.findByEmail(profile.email);
            if (existingUser) {
                await this.#linkIfNotAlready(existingUser.id, provider, profile.providerUserId);
                return toPublicUser(existingUser);
            }
        }

        let user;
        try {
            user = await this.#users.create({
                email: profile.email,
                displayName: profile.displayName,
                // passwordHash omitted — see migration 0004.
            });
        } catch (error) {
            if (!isUniqueViolation(error)) {
                throw error;
            }
            if (!profile.emailVerified) {
                // The email is already taken and this provider never proved
                // ownership of it — refuse, don't guess. The account owner
                // can still sign in the way they always have; this OAuth
                // identity just isn't attached to it.
                throw new ConflictError(
                    `An account with email ${profile.email} already exists, but ${provider} didn't confirm you own that address. Sign in another way, or use a different ${provider} account.`,
                );
            }
            // profile.emailVerified was true, so the up-front findByEmail
            // above should have already found this account — reaching here
            // means a genuine concurrent insert won the race in between.
            // Re-fetch and link; this is the one case where "someone else
            // just created the exact account we were about to create" is
            // legitimate, not an attack.
            const winner = await this.#users.findByEmail(profile.email);
            if (!winner) {
                throw new Error(`Unique violation on users.email but no matching row found (${profile.email}).`);
            }
            user = winner;
        }

        await this.#linkIfNotAlready(user.id, provider, profile.providerUserId);
        return toPublicUser(user);
    }

    async #linkIfNotAlready(userId: string, provider: OAuthProviderName, providerUserId: string): Promise<void> {
        try {
            await this.#authProviders.link({ userId, provider, providerUserId });
        } catch (error) {
            // Lost a race with a concurrent login linking the same provider
            // identity — not an error, the link already exists.
            if (!isUniqueViolation(error)) {
                throw error;
            }
        }
    }
}
