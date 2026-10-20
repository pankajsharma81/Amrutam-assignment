import { Request } from 'express';

/**
 * Authenticated user payload — attached by authMiddleware.
 */
export interface AuthUser {
    id: number;
    uuid: string;
    user_type: string;
}

/**
 * Authenticated admin payload — attached by adminAuthMiddleware.
 */
export interface AuthAdmin {
    admin_id: number;
    uuid: string;
    user_type: string;
    email: string;
}

/**
 * Express Request extended with authenticated user context.
 */
export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}

/**
 * Express Request extended with authenticated admin context.
 */
export interface AdminAuthRequest extends Request {
    admin?: AuthAdmin;
}
