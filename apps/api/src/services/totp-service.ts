import {
    decryptSecret,
    encryptSecret,
    generateRecoveryCodes,
    generateSecret,
    hashRecoveryCode,
    otpauthUri,
    verifyTotp,
} from '../lib/totp.ts';
import { BadRequestError, ConflictError, TwoFactorRequiredError, UnauthorizedError } from '../lib/errors.ts';
import type { TotpRepository } from '../repository/totp.repository.ts';
import type { UserRepository } from '../repository/user.repository.ts';
import type { UserService } from './user-service.ts';

/** Optional TOTP two-factor authentication for an account (issue #154). */
export class TotpService {
    readonly #repository: TotpRepository;
    readonly #users: UserService;
    readonly #userRepository: UserRepository;

    public constructor(repository: TotpRepository, users: UserService, userRepository: UserRepository) {
        this.#repository = repository;
        this.#users = users;
        this.#userRepository = userRepository;
    }

    public async isEnabled(userId: string): Promise<boolean> {
        return (await this.#repository.find(userId))?.enabled === true;
    }

    /**
     * Starts enrolment: creates a secret that is inert until {@link enable} proves the
     * user's app can produce codes for it.
     *
     * @throws {ConflictError} If two-factor is already on (disable it first).
     */
    public async beginSetup(userId: string): Promise<{ secret: string; otpauthUri: string }> {
        const existing = await this.#repository.find(userId);
        if (existing?.enabled) throw new ConflictError('Two-factor authentication is already enabled.');
        const user = await this.#users.getUserById(userId);
        const secret = generateSecret();
        await this.#repository.savePending(userId, encryptSecret(secret));
        return { secret, otpauthUri: otpauthUri(secret, user.email) };
    }

    /**
     * Confirms enrolment with a first valid code and returns the recovery codes. They are
     * shown exactly once; only hashes are kept.
     */
    public async enable(userId: string, code: string): Promise<string[]> {
        const record = await this.#repository.find(userId);
        if (!record) throw new BadRequestError('Start setup first.');
        if (record.enabled) throw new ConflictError('Two-factor authentication is already enabled.');
        if (!verifyTotp(decryptSecret(record.secretEncrypted), code)) {
            throw new BadRequestError('That code is not valid.');
        }
        const codes = generateRecoveryCodes();
        await this.#repository.enable(userId, codes.map(hashRecoveryCode));
        return codes;
    }

    /**
     * Turns two-factor off. Needs a current code (or recovery code), and the password too for
     * accounts that have one, so a stolen session alone cannot remove the second factor.
     */
    public async disable(userId: string, code: string, password: string | undefined): Promise<void> {
        const user = await this.#userRepository.findById(userId);
        if (!user) throw new UnauthorizedError('Authentication required.');
        // OAuth-only accounts have no password; for them the code alone is the proof.
        if (user.passwordHash !== null) {
            if (!password) throw new BadRequestError('Password required.');
            await this.#users.authenticateUser(user.email, password);
        }
        if (!(await this.#checkCode(userId, code))) throw new UnauthorizedError('That code is not valid.');
        await this.#repository.remove(userId);
    }

    /**
     * Second step of login. A no-op when two-factor is off.
     *
     * @throws {TwoFactorRequiredError} If it is on and no code was sent.
     * @throws {UnauthorizedError} If the code is wrong.
     */
    public async assertLoginCode(userId: string, code: string | undefined): Promise<void> {
        if (!(await this.isEnabled(userId))) return;
        if (!code) throw new TwoFactorRequiredError();
        if (!(await this.#checkCode(userId, code))) throw new UnauthorizedError('That code is not valid.');
    }

    async #checkCode(userId: string, code: string): Promise<boolean> {
        const record = await this.#repository.find(userId);
        if (!record?.enabled) return false;
        if (verifyTotp(decryptSecret(record.secretEncrypted), code)) return true;
        // A recovery code works once.
        return this.#repository.consumeRecoveryHash(userId, hashRecoveryCode(code));
    }
}
