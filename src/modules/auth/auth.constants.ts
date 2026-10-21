import { env } from '../../config/env';

export const AUTH_CONSTANTS = {
    SALT_ROUNDS: env.SALT_ROUNDS,
    EMAIL_VERIFICATION_TTL_HOURS: 24,

    MAX_FAILED_LOGINS: 5,
    LOCKOUT_MINUTES: 15,

    MESSAGES: {
        INVALID_CREDENTIALS: 'Invalid credentials',
        INACTIVE_ACCOUNT: 'Account is inactive. Please contact support.',
        ACCOUNT_LOCKED: 'Too many failed attempts. Try again later.',
        OTP_SENT: 'If an account exists for this email, an OTP has been sent.',
        OTP_INVALID: 'Invalid or expired OTP. Please try again.',
        OTP_VERIFIED: 'OTP verified successfully. You can now reset your password.',
        PASSWORD_RESET_SUCCESS: 'Password has been reset successfully.',
        PASSWORD_CHANGED: 'Password changed successfully.',
        EMAIL_NOT_FOUND: 'No account found with this email address.',
        USER_NOT_FOUND: 'User not found',
        INCORRECT_PASSWORD: 'Current password is incorrect.',
        EMAIL_NOT_VERIFIED: 'Email not verified. Please verify OTP first.',
        INVALID_REFRESH_TOKEN: 'Invalid or expired refresh token.',
        SESSION_REVOKED: 'Session revoked. Please login again.',
        LOGOUT_SUCCESS: 'Logged out successfully.',

        REGISTER_SUCCESS: 'Registration successful. Please verify your email.',
        EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
        EMAIL_VERIFIED: 'Email verified successfully.',
        VERIFICATION_TOKEN_INVALID: 'Invalid or expired verification token.',

        MFA_REQUIRED: 'MFA code required.',
        MFA_INVALID_CODE: 'Invalid MFA code.',
        MFA_ENABLED: 'MFA enabled successfully.',
        MFA_ALREADY_ENABLED: 'MFA is already enabled for this account.',
        MFA_TOKEN_INVALID: 'Invalid or expired MFA token.',
    },

    SELECT: {
        uuid: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        is_active: true,
        email_verified: true,
        mfa_enabled: true,
        created_at: true,
        updated_at: true,
    },
    
} as const;