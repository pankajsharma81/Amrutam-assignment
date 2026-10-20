import { UserRole } from '@prisma/client';
import { AuthRepo } from './auth.repo';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { AUTH_CONSTANTS } from './auth.constants';
import { hashPassword, verifyPassword } from './auth.tokens';
import { env } from '../../config/env';
import { generateToken, sha256 } from '../../shared/utils/token';
import { sendVerificationEmail } from '../../shared/services/mailer';

export const getUserByEmail = async (email: string) => {
    const user = await AuthRepo.findByEmailWithPassword(email);
    if (!user) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }
    return user;
};

export const authenticateUser = async (email: string, password: string) => {
    const user = await getUserByEmail(email);

    if (!user.is_active) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INACTIVE_ACCOUNT, HTTP_STATUS.FORBIDDEN);
    }

    const isValid = await verifyPassword(password, user.password ?? '');
    if (!isValid) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    const { password: _pwd, ...safeUser } = user;
    return safeUser;
};

interface RegisterInput {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: UserRole;
}

export const registerUser = async (input: RegisterInput) => {
    const passwordHash = await hashPassword(input.password);

    const token = generateToken();
    const expiresAt = new Date(
        Date.now() + AUTH_CONSTANTS.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );

    const user = await AuthRepo.createUserWithVerificationToken(
        {
            email: input.email,
            name: input.name,
            password: passwordHash,
            phone: input.phone,
            role: input.role,
        },
        sha256(token),
        expiresAt,
    );

    void sendVerificationEmail(user.email, token);

    const exposeToken = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';

    return { user, devVerificationToken: exposeToken ? token : undefined };
};