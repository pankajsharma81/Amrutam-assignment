import type { UserRole } from '@prisma/client';
export type { UserRole };

export interface AuthUser {
    id: number;
    uuid: string;
    email: string;
    name: string;
    role: UserRole;
    is_active: boolean;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface AuthUserPublic {
    uuid: string;
    email: string;
    name: string;
    role: UserRole;
    is_active: boolean;
    created_at: Date;
}

export interface LoginResult {
    user: AuthUserPublic;
}
