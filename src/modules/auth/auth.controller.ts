import { Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { AuthenticatedRequest } from '../../types';
import {
    loginSchema,
    changePasswordSchema,
    refreshTokenSchema,
    logoutSchema,
    registerSchema,
    mfaConfirmSchema,
    mfaVerifySchema,
} from './auth.schema';
import {
    generateTokenPair,
    hashPassword,
    hashRefreshToken,
    verifyPassword,
    verifyRefreshTokenHash,
} from './auth.tokens';
import { confirmMfa, enrollMfa, loginUser, registerUser, verifyMfaLogin } from './auth.service';
import { AuthRepo } from './auth.repo';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS } from '../../shared/constants';
import { AUTH_ERROR_CODES } from '../../shared/constants/authErrorCodes';
import { AUTH_CONSTANTS } from './auth.constants';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';
import { UserRole } from '@prisma/client';
import { requireUser } from '../../shared/utils/requireUser';
import { audit } from '../../shared/utils/audit';
import { sha256 } from '../../shared/utils/token';

interface RefreshTokenPayload extends JwtPayload {
    sub: string;
    sid: string;
    typ: 'refresh';
}

const parseRefreshToken = (token: string): RefreshTokenPayload | null => {
    try {
        const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
            algorithms: ['HS256'],
        }) as unknown as RefreshTokenPayload;
        return decoded.typ === 'refresh' && decoded.sid && decoded.sub ? decoded : null;
    } catch {
        return null;
    }
};

export const registerHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body } = registerSchema.parse({ body: req.body });

    const { user, devVerificationToken } = await registerUser(body);

    await audit(req, {
        action: 'USER_REGISTERED',
        resource: 'user',
        resourceId: user.uuid,
        metadata: { role: user.role },
    });

    sendSuccess(
        res,
        {
            user,
            ...(devVerificationToken && { dev_verification_token: devVerificationToken }),
        },
        AUTH_CONSTANTS.MESSAGES.REGISTER_SUCCESS,
        HTTP_STATUS.CREATED,
    );
});

const issueSession = async (
    req: Request,
    internalId: number,
    user: { uuid: string; role: UserRole },
) => {
    const tokenPair = generateTokenPair({
        id: internalId,
        uuid: user.uuid,
        user_type: user.role,
    });

    const tokenHash = await hashRefreshToken(tokenPair.refresh_token);
    await AuthRepo.createRefreshSession(
        internalId,
        tokenPair.sid,
        tokenHash,
        req.ip,
        req.get('user-agent'),
    );

    return {
        access_token: tokenPair.access_token,
        refresh_token: tokenPair.refresh_token,
        token_type: tokenPair.token_type,
        expires_in: tokenPair.expires_in,
    };
};

export const loginHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { email, password } } = loginSchema.parse({ body: req.body });

    const { user, internalId, mfaRequired } = await loginUser(email, password).catch(
        async (error) => {
            await audit(req, {
                action: 'LOGIN_FAILED',
                resource: 'auth',
                metadata: { email_hash: sha256(email) },
            });
            throw error;
        },
    );

    const actor = { id: internalId, user_type: user.role };

    if (mfaRequired) {
        const mfa_token = jwt.sign(
            { sub: user.uuid, typ: 'mfa' },
            env.JWT_ACCESS_SECRET,
            { expiresIn: '5m', algorithm: 'HS256' },
        );
        await audit(req, { actor, action: 'LOGIN_MFA_CHALLENGE', resource: 'auth', resourceId: user.uuid });
        return sendSuccess(res, { mfa_required: true, mfa_token });
    }

    const session = await issueSession(req, internalId, user);
    await audit(req, { actor, action: 'LOGIN_SUCCESS', resource: 'auth', resourceId: user.uuid });

    sendSuccess(res, { mfa_required: false, ...session, user });
});

export const refreshTokenHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { refresh_token } } = refreshTokenSchema.parse({ body: req.body });

    const invalid = () => new AppError(
        AUTH_CONSTANTS.MESSAGES.INVALID_REFRESH_TOKEN,
        HTTP_STATUS.UNAUTHORIZED,
        AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
    );

    const decoded = parseRefreshToken(refresh_token);
    if (!decoded) throw invalid();

    const session = await AuthRepo.findRefreshSessionBySid(decoded.sid);
    if (!session) throw invalid();

    if (session.revoked_at) {
        if (session.replaced_by_session) {
            await AuthRepo.revokeAllSessionsByUserId(session.user_id);
        }
        throw new AppError(
            AUTH_CONSTANTS.MESSAGES.SESSION_REVOKED,
            HTTP_STATUS.UNAUTHORIZED,
            AUTH_ERROR_CODES.SESSION_REVOKED,
        );
    }

    const isMatch = await verifyRefreshTokenHash(refresh_token, session.token_hash);
    if (!isMatch) {
        await AuthRepo.revokeRefreshSession(session.session_id);
        throw invalid();
    }

    const user = await AuthRepo.findByUuid(decoded.sub);
    if (!user || !user.is_active) {
        throw new AppError(
            AUTH_CONSTANTS.MESSAGES.USER_NOT_FOUND,
            HTTP_STATUS.UNAUTHORIZED,
            AUTH_ERROR_CODES.USER_NOT_FOUND_OR_INACTIVE,
        );
    }

    const tokenPair = generateTokenPair({
        id: session.user_id,
        uuid: user.uuid,
        user_type: user.role,
    });
    const tokenHash = await hashRefreshToken(tokenPair.refresh_token);

    const rotated = await AuthRepo.rotateRefreshSession(
        session.session_id,
        session.user_id,
        tokenPair.sid,
        tokenHash,
        req.ip,
        req.get('user-agent'),
    );

    if (!rotated) {
        await AuthRepo.revokeAllSessionsByUserId(session.user_id);
        throw new AppError(
            AUTH_CONSTANTS.MESSAGES.SESSION_REVOKED,
            HTTP_STATUS.UNAUTHORIZED,
            AUTH_ERROR_CODES.SESSION_REVOKED,
        );
    }

    if (session.revoked_at) {
        if (session.replaced_by_session) {
            await AuthRepo.revokeAllSessionsByUserId(session.user_id);
            await audit(req, {
                actor: { id: session.user_id },
                action: 'REFRESH_TOKEN_REUSE_DETECTED',
                resource: 'session',
                resourceId: session.session_id,
            });
        }
    }

    sendSuccess(res, {
        access_token: tokenPair.access_token,
        refresh_token: tokenPair.refresh_token,
        token_type: tokenPair.token_type,
        expires_in: tokenPair.expires_in,
    });
});

export const logoutHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { refresh_token } } = logoutSchema.parse({ body: req.body });

    const decoded = parseRefreshToken(refresh_token);
    if (decoded) {
        await AuthRepo.revokeRefreshSession(decoded.sid);
    }

    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.LOGOUT_SUCCESS);
});

export const logoutAllHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
        throw new AppError(
            AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS,
            HTTP_STATUS.UNAUTHORIZED,
            AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        );
    }
    await AuthRepo.revokeAllSessionsByUserId(req.user.id);

    await audit(req, { actor: req.user, action: 'LOGOUT_ALL', resource: 'user', resourceId: req.user.uuid });
    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.LOGOUT_SUCCESS);
});

export const changePasswordHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body: { current_password, new_password } } = changePasswordSchema.parse({ body: req.body });

    const userUuid = req.user?.uuid;
    if (!userUuid || !req.user?.id) {
        throw new AppError(
            AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS,
            HTTP_STATUS.UNAUTHORIZED,
            AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        );
    }

    const user = await AuthRepo.findByUuidWithPassword(userUuid);
    if (!user || !user.password) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const isValid = await verifyPassword(current_password, user.password);
    if (!isValid) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INCORRECT_PASSWORD, HTTP_STATUS.BAD_REQUEST);
    }

    const hashed = await hashPassword(new_password);
    await AuthRepo.updatePassword(userUuid, hashed);
    await AuthRepo.revokeAllSessionsByUserId(req.user.id);

    await audit(req, {
        actor: req.user,
        action: 'PASSWORD_CHANGED',
        resource: 'user',
        resourceId: userUuid,
    });

    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.PASSWORD_CHANGED);
});


export const mfaEnrollHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const actor = requireUser(req);
    const result = await enrollMfa(actor.uuid);
    await audit(req, { actor, action: 'MFA_ENROLL_STARTED', resource: 'user', resourceId: actor.uuid });
    sendSuccess(res, result);
});

export const mfaConfirmHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = mfaConfirmSchema.parse({ body: req.body });
    const actor = requireUser(req);
    await confirmMfa(actor.uuid, body.code);
    await audit(req, { actor, action: 'MFA_ENABLED', resource: 'user', resourceId: actor.uuid });
    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.MFA_ENABLED);
});

export const mfaVerifyHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body } = mfaVerifySchema.parse({ body: req.body });

    const { user, internalId } = await verifyMfaLogin(body.mfa_token, body.code).catch(
        async (error) => {
            await audit(req, { action: 'MFA_LOGIN_FAILED', resource: 'auth' });
            throw error;
        },
    );

    const session = await issueSession(req, internalId, user);
    await audit(req, {
        actor: { id: internalId, user_type: user.role },
        action: 'MFA_LOGIN_SUCCESS',
        resource: 'auth',
        resourceId: user.uuid,
    });
    sendSuccess(res, { ...session, user });
});