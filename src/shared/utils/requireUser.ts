import { AuthenticatedRequest } from '../../types';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../constants';

export const requireUser = (req: AuthenticatedRequest) => {
    if (!req.user) {
        throw new AppError(RESPONSE_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED);
    }
    return req.user;
};