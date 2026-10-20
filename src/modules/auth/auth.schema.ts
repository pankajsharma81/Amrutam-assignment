import { z } from 'zod';

// ── Login ─────────────────────────────────────────────────────
export const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        password: z.string().min(1, 'Password is required'),
    }),
});

// ── Refresh token ─────────────────────────────────────────────
export const refreshTokenSchema = z.object({
    body: z.object({
        refresh_token: z.string().min(10, 'Refresh token is required'),
    }),
});

// ── Logout ────────────────────────────────────────────────────
export const logoutSchema = z.object({
    body: z.object({
        refresh_token: z.string().min(10, 'Refresh token is required'),
    }),
});

// ── Password reset flow ───────────────────────────────────────
export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
    }),
});

export const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        otp: z.string().length(6, 'OTP must be 6 digits'),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Invalid email address'),
        new_password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number'),
    }),
});

// ── Change password (authenticated) ──────────────────────────
export const changePasswordSchema = z.object({
    body: z.object({
        current_password: z.string().min(1, 'Current password is required'),
        new_password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number'),
    }),
});
