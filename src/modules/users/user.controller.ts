import { Request, Response } from 'express';
import {
    createUserSchema,
    updateUserSchema,
    getUserSchema,
    listUsersSchema,
} from './user.schema';
import { UserService } from './user.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS } from '../../shared/constants';
import { USER_CONSTANTS } from './user.constants';

export const listUsersHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { query } = listUsersSchema.parse({ query: req.query });
    const result = await UserService.list(query);
    sendSuccess(res, result, USER_CONSTANTS.MESSAGES.LISTED);
});

export const getUserHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { params: { uuid } } = getUserSchema.parse({ params: req.params });
    const user = await UserService.getByUuid(uuid);
    sendSuccess(res, user);
});

export const createUserHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body } = createUserSchema.parse({ body: req.body });
    const user = await UserService.create(body);
    sendSuccess(res, user, USER_CONSTANTS.MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const updateUserHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { params: { uuid }, body } = updateUserSchema.parse({ params: req.params, body: req.body });
    const user = await UserService.update(uuid, body);
    sendSuccess(res, user, USER_CONSTANTS.MESSAGES.UPDATED);
});

export const deleteUserHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { params: { uuid } } = getUserSchema.parse({ params: req.params });
    await UserService.delete(uuid);
    sendSuccess(res, null, USER_CONSTANTS.MESSAGES.DELETED);
});
