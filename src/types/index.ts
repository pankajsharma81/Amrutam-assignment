import { Request } from 'express';

export interface AuthUser {
    id: number;
    uuid: string;
    user_type: string;
}

export interface AuthAdmin {
    admin_id: number;
    uuid: string;
    user_type: string;
    email: string;
}

export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}

export interface AdminAuthRequest extends Request {
    admin?: AuthAdmin;
}
