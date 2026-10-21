import { z } from 'zod';

const uuidParams = z.object({ uuid: z.string().uuid('Invalid UUID') });

export const intentSchema = z.object({
    body: z.object({ consultation_uuid: z.string().uuid('Invalid consultation UUID') }).strict(),
});

export const webhookSchema = z.object({
    body: z.object({
        event: z.enum(['payment.succeeded', 'payment.failed']),
        provider_ref: z.string().trim().min(1).max(100),
    }),
});

export const idParamSchema = z.object({ params: uuidParams });

export const listSchema = z.object({
    query: z.object({
        status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']).optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(50).default(20),
    }),
});

export const refundSchema = z.object({
    params: uuidParams,
    body: z
        .object({
            amount: z
                .number()
                .positive()
                .max(100000)
                .refine((v) => Math.round(v * 100) / 100 === v, 'Max 2 decimal places')
                .optional(),
        })
        .strict(),
});

export type ListPaymentsQuery = z.infer<typeof listSchema>['query'];
export type WebhookEvent = z.infer<typeof webhookSchema>['body']['event'];