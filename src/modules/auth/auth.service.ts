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
import jwt, { JwtPayload } from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { encrypt, decrypt } from '../../shared/utils/crypto';
import { getRedisClient } from '../../config/redis';

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

authenticator.options = { window: 1 };

const MFA_REPLAY_TTL_SECONDS = 90;

const consumeMfaCode = async (userId: number, code: string): Promise<boolean> => {
    try {
        const res = await getRedisClient().set(
            `mfa:used:${userId}:${code}`,
            '1',
            'EX',
            MFA_REPLAY_TTL_SECONDS,
            'NX',
        );
        return res === 'OK';
    } catch {
        throw new AppError('Service temporarily unavailable', HTTP_STATUS.SERVICE_UNAVAILABLE);
    }
};

const invalidMfaCode = () =>
    new AppError(AUTH_CONSTANTS.MESSAGES.MFA_INVALID_CODE, HTTP_STATUS.UNAUTHORIZED);

export const enrollMfa = async (userUuid: string) => {
    const state = await AuthRepo.findMfaStateByUuid(userUuid);
    if (!state || !state.is_active) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.USER_NOT_FOUND, HTTP_STATUS.UNAUTHORIZED);
    }
    if (state.mfa_enabled) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.MFA_ALREADY_ENABLED, HTTP_STATUS.CONFLICT);
    }

    const secret = authenticator.generateSecret();
    await AuthRepo.setMfaSecret(state.id, encrypt(secret));

    return {
        secret,
        otpauth_url: authenticator.keyuri(state.email, env.MFA_ISSUER, secret),
    };
};

export const confirmMfa = async (userUuid: string, code: string) => {
    const state = await AuthRepo.findMfaStateByUuid(userUuid);
    if (!state || !state.is_active) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.USER_NOT_FOUND, HTTP_STATUS.UNAUTHORIZED);
    }
    if (state.mfa_enabled) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.MFA_ALREADY_ENABLED, HTTP_STATUS.CONFLICT);
    }
    if (!state.mfa_secret_enc) {
        throw new AppError('Start MFA enrollment first', HTTP_STATUS.BAD_REQUEST);
    }

    if (!authenticator.check(code, decrypt(state.mfa_secret_enc))) throw invalidMfaCode();
    if (!(await consumeMfaCode(state.id, code))) throw invalidMfaCode();

    await AuthRepo.enableMfa(state.id);
};

export const verifyMfaLogin = async (mfaToken: string, code: string) => {
    const tokenInvalid = () =>
        new AppError(AUTH_CONSTANTS.MESSAGES.MFA_TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);

    let payload: JwtPayload;
    try {
        payload = jwt.verify(mfaToken, env.JWT_ACCESS_SECRET, {
            algorithms: ['HS256'],
        }) as JwtPayload;
    } catch {
        throw tokenInvalid();
    }
    if (payload.typ !== 'mfa' || !payload.sub) throw tokenInvalid();

    const state = await AuthRepo.findMfaStateByUuid(String(payload.sub));
    if (!state || !state.is_active || !state.mfa_enabled || !state.mfa_secret_enc) {
        throw tokenInvalid();
    }
    if (state.locked_until && state.locked_until > new Date()) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.ACCOUNT_LOCKED, HTTP_STATUS.TOO_MANY_REQUESTS);
    }

    if (!authenticator.check(code, decrypt(state.mfa_secret_enc))) {
        await AuthRepo.recordFailedLogin(
            state.id,
            AUTH_CONSTANTS.MAX_FAILED_LOGINS,
            AUTH_CONSTANTS.LOCKOUT_MINUTES,
        );
        throw invalidMfaCode();
    }
    if (!(await consumeMfaCode(state.id, code))) throw invalidMfaCode();

    await AuthRepo.recordSuccessfulLogin(state.id);

    const user = await AuthRepo.findByUuid(state.uuid);
    if (!user) throw tokenInvalid();

    return { user, internalId: state.id };
};