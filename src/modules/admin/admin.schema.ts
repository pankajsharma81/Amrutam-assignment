import { z } from 'zod';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const day = z.string().regex(DAY, 'Use YYYY-MM-DD').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');

export const auditLogsSchema = z.object({
    query: z.object({
        actor_id: z.coerce.number().int().positive().optional(),
        action: z.string().trim().min(1).max(64).optional(),
        resource: z.string().trim().min(1).max(64).optional(),
        resource_id: z.string().trim().min(1).max(64).optional(),
        from: day.optional(),
        to: day.optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
});

export const analyticsSchema = z.object({
    query: z.object({
        from: day.optional(),
        to: day.optional(),
        limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
});

export type AuditLogsQuery = z.infer<typeof auditLogsSchema>['query'];
export type AnalyticsQuery = z.infer<typeof analyticsSchema>['query'];