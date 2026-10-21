import { UserRole } from '@prisma/client';
import { UserRepo } from './user.repo';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { USER_CONSTANTS } from './user.constants';

const notFound = () => new AppError(USER_CONSTANTS.MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

export const UserService = {
    list: (filters: {
        search?: string;
        role?: UserRole;
        is_active?: boolean;
        page?: number;
        limit?: number;
    }) => UserRepo.list(filters),

    getByUuid: async (uuid: string) => {
        const user = await UserRepo.findByUuid(uuid);
        if (!user) throw notFound();
        return user;
    },

    updateMe: async (uuid: string, payload: { name?: string; phone?: string }) => {
        const user = await UserRepo.findByUuid(uuid);
        if (!user) throw notFound();
        return UserRepo.update(uuid, payload);
    },

    updateRole: async (actorUuid: string, targetUuid: string, role: UserRole) => {
        if (actorUuid === targetUuid) {
            throw new AppError('You cannot change your own role', HTTP_STATUS.BAD_REQUEST);
        }
        const user = await UserRepo.findByUuid(targetUuid);
        if (!user) throw notFound();

        const updated = await UserRepo.update(targetUuid, { role });
        await UserRepo.revokeSessions(targetUuid);
        return updated;
    },

    delete: async (actorUuid: string, targetUuid: string) => {
        if (actorUuid === targetUuid) {
            throw new AppError('You cannot delete your own account', HTTP_STATUS.BAD_REQUEST);
        }
        const user = await UserRepo.findByUuid(targetUuid);
        if (!user) throw notFound();

        await UserRepo.softDelete(targetUuid);
        await UserRepo.revokeSessions(targetUuid);
    },
};