import pg from 'pg';

import { config } from '../config/index.ts';

/** A row shape returned by a query. */
export type DatabaseRow = Record<string, unknown>;

/**
 * The subset of pg's client surface a repository depends on. Both `Pool` and
 * a transaction-bound `PoolClient` satisfy it, which is what lets a
 * repository accept either and so be composed into a transaction without
 * changing.
 */
export interface Queryable {
    /**
     * Run a parameterised SQL query.
     *
     * @param sql - The SQL statement, with `$1`, `$2`, ... placeholders.
     * @param values - Values bound to the statement's placeholders, in order.
     * @returns The matched rows and the row count.
     */
    query<Row extends DatabaseRow>(
        sql: string,
        values?: readonly unknown[],
    ): Promise<{ rows: Row[]; rowCount: number | null }>;
}

export class DatabaseConnectionPool implements Queryable {
    readonly #pool: pg.Pool;

    /**
     * @param connectionString - A PostgreSQL connection URI
     *   (`postgresql://user:pass@host:port/db`).
     */
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

    /**
     * @param sql - The SQL statement, with `$1`, `$2`, ... placeholders.
     * @param values - Values bound to the statement's placeholders, in order.
     * @returns The matched rows and the row count.
     */
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
     *
     * @param work - Receives a transaction-scoped `Queryable` and returns the
     *   result to commit.
     * @returns Whatever `work` resolved to, once the transaction has committed.
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

    /**
     * True when the database answers. Backs a future readiness probe.
     *
     * @returns Whether a trivial query against the pool succeeded.
     */
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

/**
 * Returns the process-wide connection pool, creating it on first call.
 *
 * @returns The shared {@link DatabaseConnectionPool} instance.
 */
export function getPool(): DatabaseConnectionPool {
    if (!sharedPool) {
        // config.databaseUrl is guaranteed set by validateConfig(), called
        // from main.ts before the app (and therefore this) is ever touched.
        if (!config.databaseUrl) {
            throw new Error('DATABASE_URL is not set.');
        }
        sharedPool = new DatabaseConnectionPool(config.databaseUrl);
    }
    return sharedPool;
}
