import { AuthRepo } from './auth.repo';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { AUTH_CONSTANTS } from './auth.constants';
import { verifyPassword } from './auth.tokens';

/**
 * Fetches an active user by email.
 * Throws AppError if the user does not exist.
 */
export const getUserByEmail = async (email: string) => {
    const user = await AuthRepo.findByEmailWithPassword(email);
    if (!user) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }
    return user;
};

/**
 * Validates credentials and returns the authenticated user.
 * Throws AppError for invalid credentials or inactive accounts.
 */
export const authenticateUser = async (email: string, password: string) => {
    const user = await getUserByEmail(email);

    if (!user.is_active) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INACTIVE_ACCOUNT, HTTP_STATUS.FORBIDDEN);
    }

    const isValid = await verifyPassword(password, user.password ?? '');
    if (!isValid) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    // Return without exposing the password hash
    const { password: _pwd, ...safeUser } = user;
    return safeUser;
};
