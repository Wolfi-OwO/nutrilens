import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import { getAdminStatsHandler, listAuditLogHandler } from '../handlers/admin.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import { validateQuery } from '../middlewares/validate.ts';
import { AdminAuditLogRepository } from '../repository/admin-audit-log.repository.ts';
import { AdminStatsRepository } from '../repository/admin-stats.repository.ts';
import { auditLogQuerySchema } from '../schemas/admin.schemas.ts';
import { AdminService } from '../services/admin-service.ts';

const pool = getPool();
const adminStatsRepository = new AdminStatsRepository(pool);
const adminAuditLogRepository = new AdminAuditLogRepository(pool);
const adminService = new AdminService(adminStatsRepository, adminAuditLogRepository);

/** The `/admin/*` endpoints (#102, #103) — every route here is admin-only. */
export const adminRouter = Router();

adminRouter.get(
    '/admin/stats',
    requireAuth,
    requireRole('admin'),
    asyncHandler(getAdminStatsHandler(adminService)),
);
adminRouter.get(
    '/admin/audit-log',
    requireAuth,
    requireRole('admin'),
    validateQuery(auditLogQuerySchema),
    asyncHandler(listAuditLogHandler(adminService)),
);
