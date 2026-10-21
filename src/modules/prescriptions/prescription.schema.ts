import { z } from 'zod';

const uuidParams = z.object({ uuid: z.string().uuid('Invalid UUID') });

const medicationSchema = z
    .object({
        name: z.string().trim().min(1).max(100),
        dosage: z.string().trim().min(1).max(50),
        frequency: z.string().trim().min(1).max(50),
        duration_days: z.number().int().positive().max(365),
        notes: z.string().trim().max(200).optional(),
    })
    .strict();

export const createPrescriptionSchema = z.object({
    params: uuidParams,
    body: z
        .object({
            medications: z.array(medicationSchema).min(1).max(20),
            instructions: z.string().trim().max(2000).optional(),
        })
        .strict(),
});

export const idParamSchema = z.object({ params: uuidParams });

export const revokeSchema = z.object({
    params: uuidParams,
    body: z.object({ reason: z.string().trim().min(3).max(300) }).strict(),
});

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>['body'];