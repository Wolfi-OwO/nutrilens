import { BadRequestError, NotFoundError } from '../lib/errors.ts';
import { findDrink, nutritionFor, summarizeDrinks } from '../lib/drink-catalog.ts';
import type { DrinkSummary } from '../lib/drink-catalog.ts';
import type { DrinkLog, DrinkLogRepository } from '../repository/drink-log.repository.ts';

const MIN_VOLUME_ML = 1;
const MAX_VOLUME_ML = 5000;
/** A bound on the range one request may read, so a client cannot ask for years of rows. */
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

function parseDate(value: string, field: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestError(`${field} must be an ISO date-time.`);
    return date;
}

/** Logging what was drunk and summarising a day (issues #209, #210). */
export class DrinkLogService {
    readonly #repository: DrinkLogRepository;

    public constructor(repository: DrinkLogRepository) {
        this.#repository = repository;
    }

    /**
     * @throws {BadRequestError} For an unknown drink or a volume outside 1 to 5000 ml.
     */
    public async log(userId: string, input: { drinkType: string; volumeMl: number; loggedAt?: string }): Promise<DrinkLog> {
        const drink = findDrink(input.drinkType);
        if (!drink) throw new BadRequestError('Unknown drink.');
        if (!Number.isInteger(input.volumeMl) || input.volumeMl < MIN_VOLUME_ML || input.volumeMl > MAX_VOLUME_ML) {
            throw new BadRequestError(`volumeMl must be a whole number from ${String(MIN_VOLUME_ML)} to ${String(MAX_VOLUME_ML)}.`);
        }
        const loggedAt = input.loggedAt === undefined ? new Date() : parseDate(input.loggedAt, 'loggedAt');
        return this.#repository.insert(userId, {
            drinkType: drink.id,
            volumeMl: input.volumeMl,
            loggedAt,
            ...(({ kcal, carbsG, sugarG, alcoholG, hydrationMl }) => ({ kcal, carbsG, sugarG, alcoholG, hydrationMl }))(
                nutritionFor(drink, input.volumeMl),
            ),
        });
    }

    /**
     * The caller's drinks in `[from, to)` with the summary computed server-side, so every
     * device shows the same day. The client chooses the range, which is how "today" follows
     * its own time zone.
     */
    public async list(userId: string, from: string, to: string): Promise<{ items: DrinkLog[]; summary: DrinkSummary }> {
        const start = parseDate(from, 'from');
        const end = parseDate(to, 'to');
        if (end <= start) throw new BadRequestError('to must be after from.');
        if (end.getTime() - start.getTime() > MAX_RANGE_MS) throw new BadRequestError('The range is limited to 31 days.');
        const items = await this.#repository.listBetween(userId, start, end);
        return { items, summary: summarizeDrinks(items) };
    }

    public async remove(userId: string, id: string): Promise<void> {
        if (!(await this.#repository.remove(userId, id))) throw new NotFoundError('Drink log not found.');
    }
}
