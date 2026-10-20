import { Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { AuthenticatedRequest } from '../../types';
import {
    loginSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema,
    changePasswordSchema,
    refreshTokenSchema,
    logoutSchema,
    registerSchema,
} from './auth.schema';
import {
    generateTokenPair,
    hashPassword,
    hashRefreshToken,
    verifyPassword,
    verifyRefreshTokenHash,
} from './auth.tokens';
import { authenticateUser, registerUser } from './auth.service';
import { AuthRepo } from './auth.repo';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS } from '../../shared/constants';
import { AUTH_ERROR_CODES } from '../../shared/constants/authErrorCodes';
import { AUTH_CONSTANTS } from './auth.constants';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';

interface RefreshTokenPayload extends JwtPayload {
    sub: string;
    sid: string;
    typ: 'refresh';
}


export const registerHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body } = registerSchema.parse({ body: req.body });

    const { user, devVerificationToken } = await registerUser(body);

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

export const loginHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { email, password } } = loginSchema.parse({ body: req.body });

    const user = await authenticateUser(email, password);
    const tokenPair = generateTokenPair({
        id: user.id,
        uuid: user.uuid,
        user_type: user.role,
    });

    const tokenHash = await hashRefreshToken(tokenPair.refresh_token);
    await AuthRepo.createRefreshSession(
        user.id,
        tokenPair.sid,
        tokenHash,
        req.ip,
        req.get('user-agent'),
    );

    sendSuccess(res, {
        access_token: tokenPair.access_token,
        refresh_token: tokenPair.refresh_token,
        token_type: tokenPair.token_type,
        expires_in: tokenPair.expires_in,
        user,
    });
});

// ─────────────────────────────────────────────────────────────
// Refresh token (token rotation)
// ─────────────────────────────────────────────────────────────

export const refreshTokenHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { refresh_token } } = refreshTokenSchema.parse({ body: req.body });

    let decoded: RefreshTokenPayload;
    try {
        decoded = jwt.verify(refresh_token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as RefreshTokenPayload;
    } catch {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_REFRESH_TOKEN, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    if (decoded.typ !== 'refresh' || !decoded.sid || !decoded.sub) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_REFRESH_TOKEN, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    const session = await AuthRepo.findRefreshSessionBySid(decoded.sid);
    if (!session) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_REFRESH_TOKEN, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    if (session.revoked_at) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.SESSION_REVOKED, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.SESSION_REVOKED);
    }

    const isMatch = await verifyRefreshTokenHash(refresh_token, session.token_hash);
    if (!isMatch) {
        await AuthRepo.revokeRefreshSession(session.session_id);
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_REFRESH_TOKEN, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN);
    }

    const user = await AuthRepo.findByUuid(String(decoded.sub));
    if (!user || !user.is_active) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.USER_NOT_FOUND, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.USER_NOT_FOUND_OR_INACTIVE);
    }

    const tokenPair = generateTokenPair({
        id: session.user_id,
        uuid: user.uuid,
        user_type: user.role,
    });

    const tokenHash = await hashRefreshToken(tokenPair.refresh_token);
    await AuthRepo.createRefreshSession(session.user_id, tokenPair.sid, tokenHash, req.ip, req.get('user-agent'));
    await AuthRepo.revokeRefreshSession(session.session_id, tokenPair.sid);

    sendSuccess(res, {
        access_token: tokenPair.access_token,
        refresh_token: tokenPair.refresh_token,
        token_type: tokenPair.token_type,
        expires_in: tokenPair.expires_in,
    });
});

// ─────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────

export const logoutHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { refresh_token } } = logoutSchema.parse({ body: req.body });

    try {
        const decoded = jwt.verify(refresh_token, env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as RefreshTokenPayload;
        if (decoded.typ === 'refresh' && decoded.sid) {
            await AuthRepo.revokeRefreshSession(decoded.sid);
        }
    } catch {
        // Intentionally swallow verify errors — logout must always succeed
    }

    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.LOGOUT_SUCCESS);
});

export const logoutAllHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
    }
    await AuthRepo.revokeAllSessionsByUserId(req.user.id);
    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.LOGOUT_SUCCESS);
});

// ─────────────────────────────────────────────────────────────
// Password reset flow
// ─────────────────────────────────────────────────────────────

export const forgotPasswordHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { email } } = forgotPasswordSchema.parse({ body: req.body });

    const user = await AuthRepo.findByEmail(email);
    if (!user) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.EMAIL_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    // TODO: integrate OtpService.sendOtp(email)
    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.OTP_SENT);
});

export const verifyOtpHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { email, otp } } = verifyOtpSchema.parse({ body: req.body });

    // TODO: integrate OtpService.verifyOtp(email, otp)
    void otp; // placeholder
    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.OTP_VERIFIED);
});

export const resetPasswordHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { body: { email, new_password } } = resetPasswordSchema.parse({ body: req.body });

    const user = await AuthRepo.findByEmail(email);
    if (!user) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.EMAIL_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const hashed = await hashPassword(new_password);
    await AuthRepo.updatePassword(user.uuid, hashed);

    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.PASSWORD_RESET_SUCCESS);
});

export const changePasswordHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body: { current_password, new_password } } = changePasswordSchema.parse({ body: req.body });

    const userUuid = req.user?.uuid;
    if (!userUuid) {
        throw new AppError(AUTH_CONSTANTS.MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_CREDENTIALS);
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

    sendSuccess(res, null, AUTH_CONSTANTS.MESSAGES.PASSWORD_CHANGED);
});
