/**
 * Machine-readable error codes sent in the `error` field of API responses.
 * Clients should switch on these codes rather than parsing message strings.
 */
export const AUTH_ERROR_CODES = {
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    INVALID_TOKEN: 'INVALID_TOKEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_TOKEN_TYPE: 'INVALID_TOKEN_TYPE',
    INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
    SESSION_REVOKED: 'SESSION_REVOKED',
    MISSING_AUTH_HEADER: 'MISSING_AUTH_HEADER',
    USER_NOT_FOUND_OR_INACTIVE: 'USER_NOT_FOUND_OR_INACTIVE',
    FORBIDDEN: 'FORBIDDEN',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
