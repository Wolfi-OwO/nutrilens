import argon2 from 'argon2';

import { BadRequestError, ConflictError } from '../lib/errors.ts';
import type { User } from '../models/user.model.ts';
import type { UserRepository } from '../repository/user.repository.ts';

const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Deliberately not a regex. `^[^\s@]+@[^\s@]+\.[^\s@]+$`-style patterns let
 * the local and domain parts both match `.` characters, so a string with
 * many repeated `@`/`.` characters has an exponential number of ways to
 * fail the match — a ReDoS on untrusted input (CodeQL flagged this as a
 * high-severity finding). Plain index/slice checks are linear by
 * construction; there's no backtracking to exploit.
 *
 * @param email - The candidate address.
 * @returns Whether `email` looks like a valid, well-formed address.
 */
function isValidEmail(email: string): boolean {
    if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || /\s/.test(email)) {
        return false;
    }
    const atIndex = email.indexOf('@');
    if (atIndex <= 0 || email.indexOf('@', atIndex + 1) !== -1) {
        return false;
    }
    const domain = email.slice(atIndex + 1);
    const dotIndex = domain.indexOf('.');
    return dotIndex > 0 && dotIndex < domain.length - 1;
}

/** Postgres unique_violation — see https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

/**
 * @param error - The value caught from a failed query.
 * @returns Whether `error` is a Postgres unique-constraint violation.
 */
function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === UNIQUE_VIOLATION
    );
}

export interface RegisterUserInput {
    email: string;
    password: string;
    displayName: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

/**
 * @param user - The full domain user, including its password hash.
 * @returns The same user with `passwordHash` stripped, safe to return to a client.
 */
function toPublicUser(user: User): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
}

export class UserService {
    readonly #repository: UserRepository;

    /** @param repository - The data-access layer for the `users` table. */
    public constructor(repository: UserRepository) {
        this.#repository = repository;
    }

    /**
     * Validates and creates a new account with a hashed password.
     *
     * @param input - The registration form fields.
     * @returns The newly created account, without its password hash.
     * @throws {BadRequestError} If any field fails validation.
     * @throws {ConflictError} If an account with `input.email` already exists.
     */
    public async registerUser(input: RegisterUserInput): Promise<PublicUser> {
        const email = input.email.trim().toLowerCase();
        const displayName = input.displayName.trim();

        if (!isValidEmail(email)) {
            throw new BadRequestError('email must be a valid email address.');
        }
        if (input.password.length < MIN_PASSWORD_LENGTH) {
            throw new BadRequestError(
                `password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
            );
        }
        if (displayName.length === 0) {
            throw new BadRequestError('displayName must not be empty.');
        }

        const passwordHash = await argon2.hash(input.password);

        try {
            const user = await this.#repository.create({ email, passwordHash, displayName });
            return toPublicUser(user);
        } catch (error) {
            // The UNIQUE constraint on users.email is the source of truth — a
            // findByEmail-then-insert check would race under concurrent
            // requests, so we let the database reject the duplicate.
            if (isUniqueViolation(error)) {
                throw new ConflictError(`An account with email ${email} already exists.`);
            }
            throw error;
        }
    }
}
