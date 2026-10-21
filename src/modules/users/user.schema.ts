import { z } from 'zod';
import { UserRole } from '@prisma/client';
const UserRoleEnum = z.nativeEnum(UserRole);

export const createUserSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        name: z.string().min(2, 'Name must be at least 2 characters').max(100),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number'),
        role: UserRoleEnum,
        phone: z.string().min(10).max(15).optional(),
    }),
});

export const updateUserSchema = z.object({
    params: z.object({
        uuid: z.string().uuid('Invalid UUID'),
    }),
    body: z.object({
        name: z.string().min(2).max(100).optional(),
        phone: z.string().min(10).max(15).optional(),
        role: UserRoleEnum.optional(),
        is_active: z.boolean().optional(),
    }),
});

export const getUserSchema = z.object({
    params: z.object({
        uuid: z.string().uuid('Invalid UUID'),
    }),
});

export const listUsersSchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).optional().default(20),
        search: z.string().optional(),
        role: UserRoleEnum.optional(),
        is_active: z
            .string()
            .optional()
            .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
    }),
});
