import pg from 'pg';

let pool: pg.Pool | undefined;

/** @returns A test-only pg pool, separate from the app's own `getPool()` singleton. */
function testPool(): pg.Pool {
    pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL });
    return pool;
}

/**
 * Promotes a user to `admin` directly via SQL — there's no admin-creation
 * API yet, so tests that need an admin caller set one up this way rather
 * than reaching into application internals.
 *
 * @param userId - The user to promote.
 */
export async function promoteToAdmin(userId: string): Promise<void> {
    await testPool().query("UPDATE users SET role = 'admin' WHERE id = $1", [userId]);
}

/**
 * The last-active-admin guard (#101) counts every active admin in the
 * whole `users` table — a genuinely global invariant, which means any
 * *other* test file concurrently creating its own admin (several do, for
 * their own `requireRole('admin')` setup) can leave "zero remaining active
 * admins" unreachable no matter how the guard test's own two accounts are
 * arranged. This clears the field immediately before such a test's guarded
 * assertion, narrowing the race to "another file's admin-creating test
 * commits in this exact instant" rather than "any of the dozens already
 * sitting in the table."
 *
 * @param exceptUserIds - Active admins to leave untouched (the test's own).
 */
export async function suspendOtherActiveAdmins(exceptUserIds: string[]): Promise<void> {
    await testPool().query(
        "UPDATE users SET status = 'suspended' WHERE role = 'admin' AND status = 'active' AND id != ALL($1)",
        [exceptUserIds],
    );
}
