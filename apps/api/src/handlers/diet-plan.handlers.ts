import type { Request, Response } from 'express';

import { BadRequestError, UnauthorizedError } from '../lib/errors.ts';
import type { DietPlanService, UpdateDietPlanFields } from '../services/diet-plan-service.ts';

function requireUser(req: Request): { id: string; role: string } {
    if (!req.user) {
        throw new UnauthorizedError('Authentication required.');
    }
    return { id: req.user.sub, role: req.user.role };
}

/**
 * The `POST /diet-plans` handler. Must be mounted behind `requireAuth`.
 *
 * @param service - The service used to validate and create the plan.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function createDietPlanHandler(service: DietPlanService) {
    return async function createDietPlan(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as Record<string, unknown>;
        const { dailyCalorieTarget, proteinTargetGrams, carbTargetGrams, fatTargetGrams, goal } = body;

        if (
            typeof dailyCalorieTarget !== 'number' ||
            typeof proteinTargetGrams !== 'number' ||
            typeof carbTargetGrams !== 'number' ||
            typeof fatTargetGrams !== 'number' ||
            typeof goal !== 'string'
        ) {
            throw new BadRequestError(
                'dailyCalorieTarget, proteinTargetGrams, carbTargetGrams, and fatTargetGrams must be numbers, and goal a string.',
            );
        }

        const plan = await service.createPlan(user.id, {
            dailyCalorieTarget,
            proteinTargetGrams,
            carbTargetGrams,
            fatTargetGrams,
            goal,
        });
        res.status(201).json(plan);
    };
}

/**
 * The `GET /diet-plans/active` handler. Must be mounted behind `requireAuth`.
 *
 * @param service - The service used to fetch the plan.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getActiveDietPlanHandler(service: DietPlanService) {
    return async function getActiveDietPlan(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const plan = await service.getActivePlan(user.id);
        res.status(200).json(plan);
    };
}

/**
 * The `GET /diet-plans` handler — the caller's own plan history. Must be
 * mounted behind `requireAuth`.
 *
 * @param service - The service used to list plans.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listDietPlansHandler(service: DietPlanService) {
    return async function listDietPlans(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const plans = await service.listPlans(user.id);
        res.status(200).json(plans);
    };
}

/**
 * The `PATCH /diet-plans/:id` handler. Must be mounted behind `requireAuth`;
 * ownership (owner or admin) is enforced by the service, not this handler.
 *
 * @param service - The service used to validate and apply the update.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function updateDietPlanHandler(service: DietPlanService) {
    return async function updateDietPlan(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const body = req.body as Record<string, unknown>;

        const fields: UpdateDietPlanFields = {};
        for (const field of [
            'dailyCalorieTarget',
            'proteinTargetGrams',
            'carbTargetGrams',
            'fatTargetGrams',
        ] as const) {
            if (field in body) {
                if (typeof body[field] !== 'number') {
                    throw new BadRequestError(`${field} must be a number.`);
                }
                fields[field] = body[field];
            }
        }
        if ('endsAt' in body) {
            if (typeof body.endsAt !== 'string') {
                throw new BadRequestError('endsAt must be a string date.');
            }
            fields.endsAt = body.endsAt;
        }

        const plan = await service.updatePlan(req.params.id as string, user, fields);
        res.status(200).json(plan);
    };
}

/**
 * The `POST /diet-plans/:id/archive` handler (UC-12). Must be mounted behind
 * `requireAuth`; ownership (owner or admin) is enforced by the service.
 *
 * @param service - The service used to archive the plan.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function archiveDietPlanHandler(service: DietPlanService) {
    return async function archiveDietPlan(req: Request, res: Response): Promise<void> {
        const user = requireUser(req);
        const plan = await service.archivePlan(req.params.id as string, user);
        res.status(200).json(plan);
    };
}
