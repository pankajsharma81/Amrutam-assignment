export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';

export interface User {
    id: number;
    uuid: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string | null;
    is_active: boolean;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface UserPublic {
    uuid: string;
    email: string;
    name: string;
    role: UserRole;
    phone?: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CreateUserPayload {
    email: string;
    name: string;
    password: string;
    role: UserRole;
    phone?: string;
}

export interface UpdateUserPayload {
    name?: string;
    phone?: string;
    role?: UserRole;
    is_active?: boolean;
}

export interface UserListResult {
    data: UserPublic[];
    total: number;
    page: number;
    limit: number;
}
