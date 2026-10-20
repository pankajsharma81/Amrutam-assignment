import { randomUUID } from 'crypto';
import { UserRepo } from './user.repo';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { USER_CONSTANTS } from './user.constants';
import { hashPassword } from '../auth/auth.tokens';
import { CreateUserPayload, UpdateUserPayload } from './user.interface';

export const UserService = {
    list: async (filters: {
        search?: string;
        role?: string;
        is_active?: boolean;
        page?: number;
        limit?: number;
    }) => {
        return UserRepo.list(filters);
    },

    getByUuid: async (uuid: string) => {
        const user = await UserRepo.findByUuid(uuid);
        if (!user) {
            throw new AppError(USER_CONSTANTS.MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
        }
        return user;
    },

    create: async (payload: CreateUserPayload) => {
        // Check for duplicate email
        const existing = await UserRepo.findByEmail(payload.email);
        if (existing) {
            throw new AppError(USER_CONSTANTS.MESSAGES.ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
        }

        const hashedPassword = await hashPassword(payload.password);
        const uuid = randomUUID();

        return UserRepo.create({ ...payload, password: hashedPassword, uuid });
    },

    update: async (uuid: string, payload: UpdateUserPayload) => {
        const user = await UserRepo.findByUuid(uuid);
        if (!user) {
            throw new AppError(USER_CONSTANTS.MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
        }
        return UserRepo.update(uuid, payload);
    },

    delete: async (uuid: string) => {
        const user = await UserRepo.findByUuid(uuid);
        if (!user) {
            throw new AppError(USER_CONSTANTS.MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
        }
        await UserRepo.softDelete(uuid);
    },
};
