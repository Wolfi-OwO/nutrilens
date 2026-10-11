import type { DatabaseRow, Queryable } from '../database/connection.ts';

export interface DrinkLog {
    id: string;
    drinkType: string;
    volumeMl: number;
    loggedAt: Date;
    kcal: number;
    carbsG: number;
    sugarG: number;
    alcoholG: number;
    hydrationMl: number;
}

interface DrinkLogRow extends DatabaseRow {
    id: string;
    drink_type: string;
    volume_ml: number;
    logged_at: Date;
    kcal: number;
    carbs_g: number;
    sugar_g: number;
    alcohol_g: number;
    hydration_ml: number;
}

const COLUMNS = 'id, drink_type, volume_ml, logged_at, kcal, carbs_g, sugar_g, alcohol_g, hydration_ml';

function toDrinkLog(row: DrinkLogRow): DrinkLog {
    return {
        id: row.id,
        drinkType: row.drink_type,
        volumeMl: row.volume_ml,
        loggedAt: row.logged_at,
        kcal: row.kcal,
        carbsG: row.carbs_g,
        sugarG: row.sugar_g,
        alcoholG: row.alcohol_g,
        hydrationMl: row.hydration_ml,
    };
}

/** Persistence for the `drink_logs` table (migration 0018). */
export class DrinkLogRepository {
    readonly #db: Queryable;

    public constructor(db: Queryable) {
        this.#db = db;
    }

    public async insert(userId: string, log: Omit<DrinkLog, 'id'>): Promise<DrinkLog> {
        const { rows } = await this.#db.query<DrinkLogRow>(
            `INSERT INTO drink_logs (user_id, drink_type, volume_ml, logged_at, kcal, carbs_g, sugar_g, alcohol_g, hydration_ml)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${COLUMNS}`,
            [userId, log.drinkType, log.volumeMl, log.loggedAt, log.kcal, log.carbsG, log.sugarG, log.alcoholG, log.hydrationMl],
        );
        return toDrinkLog(rows[0] as DrinkLogRow);
    }

    public async listBetween(userId: string, from: Date, to: Date): Promise<DrinkLog[]> {
        const { rows } = await this.#db.query<DrinkLogRow>(
            `SELECT ${COLUMNS} FROM drink_logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3 ORDER BY logged_at ASC`,
            [userId, from, to],
        );
        return rows.map(toDrinkLog);
    }

    /** @returns Whether a row of this user's was deleted. */
    public async remove(userId: string, id: string): Promise<boolean> {
        const { rowCount } = await this.#db.query('DELETE FROM drink_logs WHERE id = $1 AND user_id = $2', [id, userId]);
        return (rowCount ?? 0) > 0;
    }
}
