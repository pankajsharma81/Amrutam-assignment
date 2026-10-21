import { z } from 'zod';

const uuidParams = z.object({ uuid: z.string().uuid('Invalid UUID') });

export const bookSchema = z.object({
    body: z.object({ slot_uuid: z.string().uuid('Invalid slot UUID') }).strict(),
});

export const listSchema = z.object({
    query: z.object({
        status: z
            .enum(['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
            .optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(50).default(20),
    }),
});

export const idParamSchema = z.object({ params: uuidParams });

export const cancelSchema = z.object({
    params: uuidParams,
    body: z.object({ reason: z.string().trim().max(300).optional() }).strict(),
});

export const rescheduleSchema = z.object({
    params: uuidParams,
    body: z.object({ new_slot_uuid: z.string().uuid('Invalid slot UUID') }).strict(),
});

export const notesSchema = z.object({
    params: uuidParams,
    body: z.object({ notes: z.string().trim().min(1).max(5000) }).strict(),
});

export type ListConsultationsQuery = z.infer<typeof listSchema>['query'];