import argon2 from 'argon2';

import { DuplicateEmailError, ValidationError } from './errors.ts';
import type { User } from './user-repository.ts';
import type { UserRepository } from './user-repository.ts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Postgres unique_violation — see https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

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

function toPublicUser(user: User): PublicUser {
    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
}

export class UserService {
    readonly #repository: UserRepository;

    public constructor(repository: UserRepository) {
        this.#repository = repository;
    }

    public async registerUser(input: RegisterUserInput): Promise<PublicUser> {
        const email = input.email.trim().toLowerCase();
        const displayName = input.displayName.trim();

        if (!EMAIL_PATTERN.test(email)) {
            throw new ValidationError('email must be a valid email address.');
        }
        if (input.password.length < MIN_PASSWORD_LENGTH) {
            throw new ValidationError(
                `password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
            );
        }
        if (displayName.length === 0) {
            throw new ValidationError('displayName must not be empty.');
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
                throw new DuplicateEmailError(email);
            }
            throw error;
        }
    }
}
