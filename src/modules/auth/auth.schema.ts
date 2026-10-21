import { z } from 'zod';

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(254);

const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
    body: z
        .object({
            email: emailSchema,
            password: passwordSchema,
            name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
            phone: z
                .string()
                .trim()
                .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
                .optional(),
            role: z.enum(['PATIENT', 'DOCTOR']).default('PATIENT'),
        })
        .strict(),
});

export const loginSchema = z.object({
    body: z.object({
        email: emailSchema,
        password: z.string().min(1, 'Password is required').max(72),
    }),
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refresh_token: z.string().min(10, 'Refresh token is required'),
    }),
});

export const logoutSchema = z.object({
    body: z.object({
        refresh_token: z.string().min(10, 'Refresh token is required'),
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: emailSchema,
    }),
});

export const verifyOtpSchema = z.object({
    body: z.object({
        email: emailSchema,
        otp: z.string().length(6, 'OTP must be 6 digits'),
    }),
});

export const resetPasswordSchema = z.object({
    body: z.object({
        email: emailSchema,
        new_password: passwordSchema,
    }),
});

export const changePasswordSchema = z.object({
    body: z.object({
        current_password: z.string().min(1, 'Current password is required').max(72),
        new_password: passwordSchema,
    }),
});

const otpCode = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

export const mfaVerifySchema = z.object({
    body: z.object({
        mfa_token: z.string().min(10, 'MFA token is required'),
        code: otpCode,
    }),
});

export const mfaConfirmSchema = z.object({
    body: z.object({ code: otpCode }),
});