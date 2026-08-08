import { randomUUID } from 'node:crypto';

/**
 * @param prefix - A label for readability in failure output.
 * @returns A unique email, so concurrently-running test files never
 *   collide on the `users.email` unique constraint.
 */
export function uniqueEmail(prefix: string): string {
    return `${prefix}-${randomUUID()}@example.test`;
}
