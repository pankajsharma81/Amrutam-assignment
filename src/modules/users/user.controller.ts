import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import {
    getUserSchema,
    listUsersSchema,
    updateMeSchema,
    updateRoleSchema,
} from './user.schema';
import { UserService } from './user.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';
import { AppError } from '../../core/errors/AppError';
import { USER_CONSTANTS } from './user.constants';
import { audit } from '../../shared/utils/audit';

const currentUser = (req: AuthenticatedRequest) => {
    if (!req.user) {
        throw new AppError(RESPONSE_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }
    return req.user;
};

export const getMeHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const user = await UserService.getByUuid(currentUser(req).uuid);
    sendSuccess(res, user);
});

export const updateMeHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = updateMeSchema.parse({ body: req.body });
    const user = await UserService.updateMe(currentUser(req).uuid, body);
    sendSuccess(res, user, USER_CONSTANTS.MESSAGES.UPDATED);
});

export const listUsersHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = listUsersSchema.parse({ query: req.query });
    const result = await UserService.list(query);
    sendSuccess(res, result, USER_CONSTANTS.MESSAGES.LISTED);
});

export const getUserHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid } } = getUserSchema.parse({ params: req.params });
    const user = await UserService.getByUuid(uuid);
    sendSuccess(res, user);
});

export const updateRoleHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid }, body: { role } } = updateRoleSchema.parse({
        params: req.params,
        body: req.body,
    });
    const actor = currentUser(req);
    const user = await UserService.updateRole(actor.uuid, uuid, role);
    await audit(req, {
        actor,
        action: 'USER_ROLE_CHANGED',
        resource: 'user',
        resourceId: uuid,
        metadata: { new_role: role },
    });
    sendSuccess(res, user, USER_CONSTANTS.MESSAGES.UPDATED);
});

export const deleteUserHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid } } = getUserSchema.parse({ params: req.params });
    const actor = currentUser(req);
    await UserService.delete(actor.uuid, uuid);
    await audit(req, { actor, action: 'USER_DELETED', resource: 'user', resourceId: uuid });
    sendSuccess(res, null, USER_CONSTANTS.MESSAGES.DELETED);
});