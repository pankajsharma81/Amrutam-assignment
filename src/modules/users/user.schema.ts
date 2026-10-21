import { z } from 'zod';
import { UserRole } from '@prisma/client';

const uuidParams = z.object({
    uuid: z.string().uuid('Invalid UUID'),
});

export const updateMeSchema = z.object({
    body: z
        .object({
            name: z.string().trim().min(2).max(100).optional(),
            phone: z
                .string()
                .trim()
                .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
                .optional(),
        })
        .strict()
        .refine((body) => Object.keys(body).length > 0, {
            message: 'At least one field is required',
        }),
});

export const getUserSchema = z.object({
    params: uuidParams,
});

export const updateRoleSchema = z.object({
    params: uuidParams,
    body: z.object({ role: z.nativeEnum(UserRole) }).strict(),
});

export const listUsersSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        search: z.string().trim().max(100).optional(),
        role: z.nativeEnum(UserRole).optional(),
        is_active: z
            .enum(['true', 'false'])
            .optional()
            .transform((v) => (v === undefined ? undefined : v === 'true')),
    }),
});