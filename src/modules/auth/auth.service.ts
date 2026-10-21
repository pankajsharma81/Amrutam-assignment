import bcrypt from 'bcrypt';
import { users, UserRole } from '@prisma/client';
import { AuthRepo } from './auth.repo';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { AUTH_CONSTANTS } from './auth.constants';
import { hashPassword, verifyPassword } from './auth.tokens';
import { env } from '../../config/env';
import { generateToken, sha256 } from '../../shared/utils/token';
import { sendVerificationEmail } from '../../shared/services/mailer';

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', env.SALT_ROUNDS);

const toPublicUser = (user: users) => ({
    uuid: user.uuid,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    is_active: user.is_active,
    email_verified: user.email_verified,
    mfa_enabled: user.mfa_enabled,
    created_at: user.created_at,
    updated_at: user.updated_at,
});

export const loginUser = async (email: string, password: string) => {
    const user = await AuthRepo.findByEmailWithPassword(email);

    if (!user) {
        await verifyPassword(password, DUMMY_HASH);
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (user.locked_until && user.locked_until > new Date()) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.ACCOUNT_LOCKED, HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
        await AuthRepo.recordFailedLogin(
            user.id,
            AUTH_CONSTANTS.MAX_FAILED_LOGINS,
            AUTH_CONSTANTS.LOCKOUT_MINUTES,
        );
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!user.is_active) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INACTIVE_ACCOUNT, HTTP_STATUS.FORBIDDEN);
    }

    if (!user.mfa_enabled) {
        await AuthRepo.recordSuccessfulLogin(user.id);
    }
    
    return { user: toPublicUser(user), internalId: user.id, mfaRequired: user.mfa_enabled };
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