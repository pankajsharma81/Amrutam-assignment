import { z } from 'zod';

const MAX_SLOTS_PER_REQUEST = 48;
const ALLOWED_MINUTES = [15, 20, 30, 45, 60];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const uuidParams = z.object({
    uuid: z.string().uuid('Invalid UUID'),
});

const isDay = (value: string) => !Number.isNaN(Date.parse(value));

export const createSlotsSchema = z.object({
    params: uuidParams,
    body: z
        .object({
            start_time: z.coerce.date(),
            end_time: z.coerce.date(),
            slot_minutes: z
                .number()
                .int()
                .refine((v) => ALLOWED_MINUTES.includes(v), 'slot_minutes must be 15, 20, 30, 45 or 60')
                .default(30),
        })
        .strict()
        .superRefine((body, ctx) => {
            if (body.end_time <= body.start_time) {
                ctx.addIssue({ code: 'custom', message: 'end_time must be after start_time' });
                return;
            }
            if (body.start_time <= new Date()) {
                ctx.addIssue({ code: 'custom', message: 'start_time must be in the future' });
            }
            const count = Math.floor(
                (body.end_time.getTime() - body.start_time.getTime()) / (body.slot_minutes * 60000),
            );
            if (count < 1) {
                ctx.addIssue({ code: 'custom', message: 'Range is shorter than one slot' });
            }
            if (count > MAX_SLOTS_PER_REQUEST) {
                ctx.addIssue({
                    code: 'custom',
                    message: `At most ${MAX_SLOTS_PER_REQUEST} slots per request`,
                });
            }
        }),
});

export const listSlotsSchema = z.object({
    params: uuidParams,
    query: z.object({
        from: z.string().regex(DAY, 'Use YYYY-MM-DD').refine(isDay, 'Invalid date').optional(),
        to: z.string().regex(DAY, 'Use YYYY-MM-DD').refine(isDay, 'Invalid date').optional(),
    }),
});

export const updateSlotSchema = z.object({
    params: uuidParams,
    body: z.object({ status: z.enum(['AVAILABLE', 'BLOCKED']) }).strict(),
});

export const slotParamsSchema = z.object({
    params: uuidParams,
});

export type CreateSlotsInput = z.infer<typeof createSlotsSchema>['body'];
export type ListSlotsQuery = z.infer<typeof listSlotsSchema>['query'];