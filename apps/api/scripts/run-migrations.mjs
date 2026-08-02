#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'database', 'migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Did you pass --env-file=.env?');
    process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

async function main() {
    await client.connect();
    await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

    const applied = new Set(
        (await client.query('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
    );
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
        if (applied.has(file)) continue;
        const sql = await readFile(join(migrationsDir, file), 'utf8');
        console.log(`Applying ${file} ...`);
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
            await client.query('COMMIT');
            count += 1;
        } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
        }
    }
    console.log(count === 0 ? 'Database already up to date.' : `Applied ${count} migration(s).`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => client.end());
