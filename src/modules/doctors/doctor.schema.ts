import { z } from 'zod';

const uuidParams = z.object({
    uuid: z.string().uuid('Invalid UUID'),
});

const languages = z
    .array(z.string().trim().toLowerCase().min(2).max(30))
    .min(1)
    .max(10);

export const createDoctorSchema = z.object({
    body: z
        .object({
            specialization: z.string().trim().min(2).max(100),
            license_number: z.string().trim().min(4).max(50),
            experience_years: z.number().int().min(0).max(70).default(0),
            consultation_fee: z.number().positive().max(100000),
            languages,
            bio: z.string().trim().max(1000).optional(),
        })
        .strict(),
});

export const updateDoctorSchema = z.object({
    params: uuidParams,
    body: z
        .object({
            specialization: z.string().trim().min(2).max(100).optional(),
            experience_years: z.number().int().min(0).max(70).optional(),
            consultation_fee: z.number().positive().max(100000).optional(),
            languages: languages.optional(),
            bio: z.string().trim().max(1000).optional(),
        })
        .strict()
        .refine((body) => Object.keys(body).length > 0, {
            message: 'At least one field is required',
        }),
});

export const getDoctorSchema = z.object({
    params: uuidParams,
});

export const verifyDoctorSchema = z.object({
    params: uuidParams,
    body: z.object({ verified: z.boolean() }).strict(),
});

export const searchDoctorsSchema = z.object({
    query: z.object({
        q: z.string().trim().max(100).optional(),
        specialization: z.string().trim().max(100).optional(),
        language: z.string().trim().toLowerCase().max(30).optional(),
        min_fee: z.coerce.number().min(0).optional(),
        max_fee: z.coerce.number().min(0).optional(),
        min_rating: z.coerce.number().min(0).max(5).optional(),
        available_on: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
            .refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date')
            .optional(),
        verified: z
            .enum(['true', 'false'])
            .optional()
            .transform((v) => (v === undefined ? undefined : v === 'true')),
        sort: z.enum(['rating', 'fee_asc', 'fee_desc', 'experience']).default('rating'),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(50).default(20),
    }),
});

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>['body'];
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>['body'];
export type DoctorSearchQuery = z.infer<typeof searchDoctorsSchema>['query'];