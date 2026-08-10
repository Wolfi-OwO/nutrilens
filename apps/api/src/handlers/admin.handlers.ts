import type { Request, Response } from 'express';
import type { z } from 'zod';

import type { auditLogQuerySchema } from '../schemas/admin.schemas.ts';
import type { AdminService } from '../services/admin-service.ts';

/**
 * The `GET /admin/stats` handler (#102, UC-66). Must be mounted behind
 * `requireAuth` + `requireRole('admin')` (see routes/admin.routes.ts).
 *
 * @param adminService - The service used to compute the stats payload.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function getAdminStatsHandler(adminService: AdminService) {
    return async function getAdminStats(_req: Request, res: Response): Promise<void> {
        const stats = await adminService.getStats();
        res.status(200).json(stats);
    };
}

/**
 * The `GET /admin/audit-log` handler (#103, UC-68). Must be mounted behind
 * `requireAuth` + `requireRole('admin')` and
 * `validateQuery(auditLogQuerySchema)` (see routes/admin.routes.ts).
 *
 * @param adminService - The service used to list audit entries.
 * @returns An async handler, to be wrapped with `asyncHandler` before mounting.
 */
export function listAuditLogHandler(adminService: AdminService) {
    return async function listAuditLog(req: Request, res: Response): Promise<void> {
        const query = req.query as unknown as z.infer<typeof auditLogQuerySchema>;
        const { entries, total } = await adminService.listAuditLog(query.page, query.pageSize);
        res.status(200).json({ entries, total, page: query.page, pageSize: query.pageSize });
    };
}
