import type { Request, Response } from 'express';
import type { z } from 'zod';

import { DRINKS } from '../lib/drink-catalog.ts';
import { UnauthorizedError } from '../lib/errors.ts';
import { withLinks } from '../lib/hateoas.ts';
import type { createDrinkLogBodySchema, listDrinkLogsQuerySchema } from '../schemas/drink-log.schemas.ts';
import type { DrinkLogService } from '../services/drink-log-service.ts';

function userId(req: Request): string {
    if (!req.user) throw new UnauthorizedError('Authentication required.');
    return req.user.sub;
}

/** `GET /drinks` — the drink catalog, so the client does not hard-code it. */
export function listDrinksHandler() {
    return function listDrinks(_req: Request, res: Response): void {
        res.status(200).json(withLinks({ items: DRINKS }, { self: { href: '/drinks' } }));
    };
}

/** `POST /drink-logs` — logs a drink at any volume; nutrition is snapshotted. */
export function createDrinkLogHandler(service: DrinkLogService) {
    return async function createDrinkLog(req: Request, res: Response): Promise<void> {
        const body = req.body as z.infer<typeof createDrinkLogBodySchema>;
        const log = await service.log(userId(req), {
            drinkType: body.drinkType,
            volumeMl: body.volumeMl,
            ...(body.loggedAt !== undefined ? { loggedAt: body.loggedAt } : {}),
        });
        res.status(201).location(`/drink-logs/${log.id}`).json(withLinks(log, { self: { href: `/drink-logs/${log.id}` } }));
    };
}

/** `GET /drink-logs?from&to` — the drinks in a range plus the server-computed summary. */
export function listDrinkLogsHandler(service: DrinkLogService) {
    return async function listDrinkLogs(req: Request, res: Response): Promise<void> {
        const { from, to } = req.query as unknown as z.infer<typeof listDrinkLogsQuerySchema>;
        const result = await service.list(userId(req), from, to);
        res.status(200).json(withLinks(result, { self: { href: '/drink-logs' } }));
    };
}

/** `DELETE /drink-logs/:id` */
export function deleteDrinkLogHandler(service: DrinkLogService) {
    return async function deleteDrinkLog(req: Request, res: Response): Promise<void> {
        await service.remove(userId(req), req.params.id ?? '');
        res.status(204).end();
    };
}
