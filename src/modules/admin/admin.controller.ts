import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../../types';
import { analyticsSchema, auditLogsSchema } from './admin.schema';
import { AdminRepo } from './admin.repo';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { cacheGet, cacheSet } from '../../shared/utils/cache';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL = 60;

const resolveRange = (from?: string, to?: string) => {
    const end = to ? Date.parse(`${to}T00:00:00.000Z`) + DAY_MS : Date.now() + 1;
    const start = from ? Date.parse(`${from}T00:00:00.000Z`) : end - 30 * DAY_MS;
    if (end <= start) {
        throw new AppError('"to" must not be before "from"', HTTP_STATUS.BAD_REQUEST);
    }
    return { start: new Date(start), end: new Date(end) };
};

const cached = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const hit = await cacheGet<T>(key);
    if (hit) return hit;
    const value = await load();
    await cacheSet(key, value, TTL);
    return value;
};

export const auditLogsHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = auditLogsSchema.parse({ query: req.query });
    const range = query.from || query.to ? resolveRange(query.from, query.to) : null;

    const where: Prisma.audit_logsWhereInput = {
        ...(query.actor_id && { actor_id: query.actor_id }),
        ...(query.action && { action: query.action }),
        ...(query.resource && { resource: query.resource }),
        ...(query.resource_id && { resource_id: query.resource_id }),
        ...(range && { created_at: { gte: range.start, lt: range.end } }),
    };

    const { total, data } = await AdminRepo.listAuditLogs(where, (query.page - 1) * query.limit, query.limit);
    sendSuccess(res, {
        data,
        pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
    });
});

export const overviewHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = analyticsSchema.parse({ query: req.query });
    const range = resolveRange(query.from, query.to);
    const key = `analytics:overview:${query.from ?? ''}:${query.to ?? ''}`;
    sendSuccess(res, await cached(key, () => AdminRepo.overview(range)));
});

export const funnelHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = analyticsSchema.parse({ query: req.query });
    const range = resolveRange(query.from, query.to);
    const key = `analytics:funnel:${query.from ?? ''}:${query.to ?? ''}`;
    const stages = await cached(key, () => AdminRepo.funnel(range));
    const total = stages.reduce((sum, s) => sum + s.count, 0);
    const completed = stages.find((s) => s.status === 'COMPLETED')?.count ?? 0;
    sendSuccess(res, {
        stages,
        total,
        completion_rate: total === 0 ? 0 : Number((completed / total).toFixed(4)),
    });
});

export const doctorsHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = analyticsSchema.parse({ query: req.query });
    const range = resolveRange(query.from, query.to);
    const key = `analytics:doctors:${query.from ?? ''}:${query.to ?? ''}:${query.limit}`;
    sendSuccess(res, await cached(key, () => AdminRepo.topDoctors(range, query.limit)));
});