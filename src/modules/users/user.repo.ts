import { UserRole } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';
import { USER_CONSTANTS } from './user.constants';
import { CreateUserPayload, UpdateUserPayload } from './user.interface';

const ENTITY = 'User';

interface ListUsersFilter {
    search?: string;
    role?: string;
    is_active?: boolean;
    page?: number;
    limit?: number;
}

export const UserRepo = {
    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { uuid, is_deleted: false },
                select: USER_CONSTANTS.SELECT,
            }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    findByEmail: (email: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { email, is_deleted: false },
                select: { id: true, uuid: true, email: true },
            }),
            { operation: 'findByEmail', entity: ENTITY },
        );
    },

    list: ({ search, role, is_active, page = 1, limit = 20 }: ListUsersFilter) => {
        return dbOperation(
            async () => {
                const where = {
                    is_deleted: false,
                    ...(is_active !== undefined && { is_active }),
                    ...(role && { role: role as UserRole }),
                    ...(search && {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' as const } },
                            { email: { contains: search, mode: 'insensitive' as const } },
                        ],
                    }),
                };

                const [data, total] = await Promise.all([
                    prisma.users.findMany({
                        where,
                        select: USER_CONSTANTS.SELECT,
                        skip: (page - 1) * limit,
                        take: limit,
                        orderBy: { created_at: 'desc' },
                    }),
                    prisma.users.count({ where }),
                ]);

                return { data, total, page, limit };
            },
            { operation: 'list', entity: ENTITY },
        );
    },

    create: (payload: CreateUserPayload & { uuid: string }) => {
        return dbOperation(
            () => prisma.users.create({
                data: {
                    uuid: payload.uuid,
                    email: payload.email,
                    name: payload.name,
                    password: payload.password, 
                    role: payload.role,
                    phone: payload.phone,
                },
                select: USER_CONSTANTS.SELECT,
            }),
            { operation: 'create', entity: ENTITY },
        );
    },

    update: (uuid: string, payload: UpdateUserPayload) => {
        return dbOperation(
            () => prisma.users.update({
                where: { uuid },
                data: { ...payload, updated_at: new Date() },
                select: USER_CONSTANTS.SELECT,
            }),
            { operation: 'update', entity: ENTITY },
        );
    },

    softDelete: (uuid: string) => {
        return dbOperation(
            () => prisma.users.update({
                where: { uuid },
                data: { is_deleted: true, is_active: false, updated_at: new Date() },
            }),
            { operation: 'softDelete', entity: ENTITY },
        );
    },

    revokeSessions: (uuid: string) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.updateMany({
                where: { revoked_at: null, user: { uuid } },
                data: { revoked_at: new Date(), updated_at: new Date() },
            }),
            { operation: 'revokeSessions', entity: 'Session' },
        );
    },
};
