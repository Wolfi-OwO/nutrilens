import pg from 'pg';

/** A row shape returned by a query. */
export type DatabaseRow = Record<string, unknown>;

/**
 * The subset of pg's client surface a repository depends on. Both `Pool` and
 * a transaction-bound `PoolClient` satisfy it, which is what lets a
 * repository accept either and so be composed into a transaction without
 * changing.
 */
export interface Queryable {
    query<Row extends DatabaseRow>(
        sql: string,
        values?: readonly unknown[],
    ): Promise<{ rows: Row[]; rowCount: number | null }>;
}

export class DatabaseConnectionPool implements Queryable {
    readonly #pool: pg.Pool;

    public constructor(connectionString: string) {
        this.#pool = new pg.Pool({ connectionString });

        // An idle client erroring means the server dropped it (restart, network,
        // idle timeout). pg surfaces this on the pool; unhandled, it terminates
        // the process.
        this.#pool.on('error', (error: Error) => {
            // No structured logger exists yet (see #61) — this is the only
            // way to surface an otherwise-unhandled idle-client error.
            // eslint-disable-next-line no-console
            console.error('idle database client errored', error);
        });
    }

    public async query<Row extends DatabaseRow>(
        sql: string,
        values: readonly unknown[] = [],
    ): Promise<{ rows: Row[]; rowCount: number | null }> {
        const result = await this.#pool.query(sql, values as unknown[]);
        return { rows: result.rows as Row[], rowCount: result.rowCount };
    }

    /**
     * Run `work` inside a transaction, committing on success and rolling back on
     * any thrown error. The client is released in `finally`, so it returns to
     * the pool even if both the work and the rollback throw.
     */
    public async transaction<Result>(
        work: (client: Queryable) => Promise<Result>,
    ): Promise<Result> {
        const client = await this.#pool.connect();
        try {
            await client.query('BEGIN');
            const result = await work(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                // eslint-disable-next-line no-console -- no structured logger yet (#61)
                console.error('transaction rollback failed', rollbackError);
            }
            throw error;
        } finally {
            client.release();
        }
    }

    /** True when the database answers. Backs a future readiness probe. */
    public async isReachable(): Promise<boolean> {
        try {
            await this.#pool.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    /** Drain the pool. Called from the shutdown handler. */
    public async shutdown(): Promise<void> {
        await this.#pool.end();
    }
}

let sharedPool: DatabaseConnectionPool | undefined;

export function getPool(): DatabaseConnectionPool {
    if (!sharedPool) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not set.');
        }
        sharedPool = new DatabaseConnectionPool(connectionString);
    }
    return sharedPool;
}
