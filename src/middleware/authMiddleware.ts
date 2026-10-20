import { Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { AuthenticatedRequest, AdminAuthRequest } from '../types';
import { env } from '../config/env';
import { AppError } from '../core/errors/AppError';
import { HTTP_STATUS } from '../shared/constants';
import { AUTH_ERROR_CODES } from '../shared/constants/authErrorCodes';

// ── Token payload shapes ──────────────────────────────────────

interface AdminTokenPayload extends JwtPayload {
    admin_id: number;
    user_type: string;
    email: string;
    uuid: string;
}

interface UserTokenPayload extends JwtPayload {
    id: number;
    user_type: string;
    uuid: string;
    typ?: 'access' | 'refresh';
}

// ── Superadmin auth ───────────────────────────────────────────

/**
 * Validates Bearer token for superadmin routes.
 * Populates `req.admin` on success.
 */
export const adminAuthMiddleware = (
    req: AdminAuthRequest,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AdminTokenPayload;
            req.admin = {
                admin_id: decoded.admin_id,
                user_type: decoded.user_type,
                email: decoded.email,
                uuid: decoded.uuid,
            };
            next();
            return;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                next(new AppError('Token has expired', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_EXPIRED));
            } else {
                next(new AppError('Invalid or expired token', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_TOKEN));
            }
            return;
        }
    }

    next(new AppError('Authorization header missing or malformed', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.MISSING_AUTH_HEADER));
};

// ── User auth ─────────────────────────────────────────────────

/**
 * Validates Bearer token for management/customer routes.
 * Populates `req.user` on success.
 */
export const authMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as UserTokenPayload;

            // Reject refresh tokens against access-protected routes
            if (decoded.typ && decoded.typ !== 'access') {
                next(new AppError('Invalid token type for this endpoint', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_TOKEN_TYPE));
                return;
            }

            req.user = {
                id: decoded.id,
                user_type: decoded.user_type,
                uuid: decoded.uuid,
            };
            next();
            return;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                next(new AppError('Token has expired', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.TOKEN_EXPIRED));
            } else {
                next(new AppError('Invalid or expired token', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.INVALID_TOKEN));
            }
            return;
        }
    }

    next(new AppError('Authorization header missing or malformed', HTTP_STATUS.UNAUTHORIZED, AUTH_ERROR_CODES.MISSING_AUTH_HEADER));
};

// ── Role guard ────────────────────────────────────────────────

/**
 * Middleware factory: restricts access to specific user roles.
 *
 * Usage:
 *   router.get('/admin-only', authMiddleware, requireRole('ADMIN', 'SUPER_ADMIN'), handler);
 */
export const requireRole = (...roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.user_type)) {
            next(new AppError('Insufficient permissions', HTTP_STATUS.FORBIDDEN, AUTH_ERROR_CODES.FORBIDDEN));
            return;
        }
        next();
    };
};
