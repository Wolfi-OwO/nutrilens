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
