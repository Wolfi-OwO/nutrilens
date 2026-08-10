/**
 * Populates a local database with representative sample data for manual
 * testing. Dev-only: refuses to run against NODE_ENV=production.
 *
 * Idempotent — matched on natural keys (a user's email; a plan/log/entry's
 * ownership), so running it repeatedly never duplicates data. Run with
 * `--reset` to wipe the seeded tables first.
 *
 * Goes through the real services (UserService, DietPlanService, ...) rather
 * than inserting rows directly, so seeded data obeys the same business rules
 * (password hashing, one-active-plan, server-derived meal totals, ...) real
 * requests do.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, isProduction, validateConfig } from '../src/config/index.ts';
import { getPool } from '../src/database/connection.ts';
import { ConflictError, NotFoundError } from '../src/lib/errors.ts';
import { DietPlanRepository } from '../src/repository/diet-plan.repository.ts';
import { MealLogRepository } from '../src/repository/meal-log.repository.ts';
import { UserRepository } from '../src/repository/user.repository.ts';
import { WeightEntryRepository } from '../src/repository/weight-entry.repository.ts';
import { DietPlanService } from '../src/services/diet-plan-service.ts';
import { MealLogService } from '../src/services/meal-log-service.ts';
import { UserService } from '../src/services/user-service.ts';
import { WeightEntryService } from '../src/services/weight-entry-service.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'database', 'data');

interface SeedUser {
    email: string;
    password: string;
    displayName: string;
    role: 'user' | 'coach' | 'admin';
}

interface SeedDietPlan {
    dailyCalorieTarget: number;
    proteinTargetGrams: number;
    carbTargetGrams: number;
    fatTargetGrams: number;
    goal: string;
}

interface SeedMealLogItem {
    foodName: string;
    portionGrams: number;
    calories: number;
    confidence?: number;
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
}

interface SeedMealLog {
    source: string;
    items: SeedMealLogItem[];
}

interface SeedWeightEntry {
    weightKg: number;
    /** Offset from now, so seeded entries always land on distinct recent days. */
    daysAgo: number;
}

async function readJson<T>(filename: string): Promise<T> {
    const raw = await readFile(join(dataDir, filename), 'utf8');
    return JSON.parse(raw) as T;
}

async function resetSeedTables(): Promise<void> {
    const pool = getPool();
    console.log('--reset: truncating seeded tables ...');
    // weight_entries has no FK to the others, so it needs its own clause;
    // users cascades into diet_plans, meal_logs and meal_log_items.
    await pool.query('TRUNCATE TABLE weight_entries, users RESTART IDENTITY CASCADE');
}

async function main(): Promise<void> {
    if (isProduction) {
        throw new Error('scripts/seed.ts is dev-only and refuses to run when NODE_ENV=production.');
    }
    validateConfig();

    if (process.argv.includes('--reset')) {
        await resetSeedTables();
    }

    const pool = getPool();
    const userRepository = new UserRepository(pool);
    const dietPlanRepository = new DietPlanRepository(pool);
    const mealLogRepository = new MealLogRepository(pool);
    const weightEntryRepository = new WeightEntryRepository(pool);

    const userService = new UserService(userRepository, pool);
    const dietPlanService = new DietPlanService(dietPlanRepository, pool);
    const mealLogService = new MealLogService(mealLogRepository, dietPlanRepository, pool);
    const weightEntryService = new WeightEntryService(weightEntryRepository);

    const users = await readJson<SeedUser[]>('users.json');
    const dietPlans = await readJson<Record<string, SeedDietPlan>>('diet-plans.json');
    const mealLogs = await readJson<Record<string, SeedMealLog[]>>('meal-logs.json');
    const weightEntries = await readJson<Record<string, SeedWeightEntry[]>>('weight-entries.json');

    let usersCreated = 0;
    let plansCreated = 0;
    let logsCreated = 0;
    let entriesCreated = 0;

    for (const seedUser of users) {
        let userId: string;
        try {
            const created = await userService.registerUser({
                email: seedUser.email,
                password: seedUser.password,
                displayName: seedUser.displayName,
            });
            userId = created.id;
            usersCreated += 1;

            if (seedUser.role !== 'user') {
                await pool.query('UPDATE users SET role = $1 WHERE id = $2', [seedUser.role, userId]);
            }
        } catch (error) {
            if (!(error instanceof ConflictError)) {
                throw error;
            }
            const existing = await userRepository.findByEmail(seedUser.email);
            if (!existing) {
                throw new Error(`ConflictError on ${seedUser.email} but no matching user found.`);
            }
            userId = existing.id;
        }

        const plan = dietPlans[seedUser.email];
        if (plan) {
            try {
                await dietPlanService.getActivePlan(userId);
            } catch (error) {
                if (!(error instanceof NotFoundError)) {
                    throw error;
                }
                await dietPlanService.createPlan(userId, plan);
                plansCreated += 1;
            }
        }

        const logsForUser = mealLogs[seedUser.email] ?? [];
        if (logsForUser.length > 0 && (await mealLogService.listLogs(userId)).length === 0) {
            for (const log of logsForUser) {
                await mealLogService.createLog(userId, log);
                logsCreated += 1;
            }
        }

        const entriesForUser = weightEntries[seedUser.email] ?? [];
        if (entriesForUser.length > 0 && (await weightEntryService.listEntries(userId, {})).length === 0) {
            for (const entry of entriesForUser) {
                const recordedAt = new Date(Date.now() - entry.daysAgo * 24 * 60 * 60 * 1000);
                await weightEntryService.createEntry(userId, {
                    weightKg: entry.weightKg,
                    recordedAt: recordedAt.toISOString(),
                });
                entriesCreated += 1;
            }
        }
    }

    console.log(
        `Seed complete: ${String(usersCreated)} user(s), ${String(plansCreated)} diet plan(s), ` +
            `${String(logsCreated)} meal log(s), ${String(entriesCreated)} weight entr(y/ies) created.`,
    );
    console.log(`Already-present users/data were left untouched (re-run with --reset to start clean).`);
    console.log(
        `Sample login: ${users[0]?.email ?? '(see database/data/users.json)'} — password in the same file ` +
            `(against ${config.databaseUrl}).`,
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await getPool().shutdown();
    });
