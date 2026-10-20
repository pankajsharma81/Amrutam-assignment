import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    loginHandler,
    refreshTokenHandler,
    logoutHandler,
    logoutAllHandler,
    forgotPasswordHandler,
    verifyOtpHandler,
    resetPasswordHandler,
    changePasswordHandler,
    registerHandler,
} from './auth.controller';
import { authMiddleware } from '../../middleware/authMiddleware';

const router = Router();

// ── Rate limiters ─────────────────────────────────────────────

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many registration attempts, please try again later.' },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many login attempts, please try again after 15 minutes.' },
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Too many OTP requests, please try again after 15 minutes.' },
});

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many refresh attempts, please try again after 15 minutes.' },
});

// ── Auth endpoints ────────────────────────────────────────────

// Public
router.post('/register', registerLimiter, registerHandler);
router.post('/login', loginLimiter, loginHandler);
router.post('/refresh-token', refreshLimiter, refreshTokenHandler);
router.post('/logout', logoutHandler);

// Authenticated
router.post('/logout-all', authMiddleware, logoutAllHandler);
router.post('/change-password', authMiddleware, changePasswordHandler);

// Password reset flow (public, OTP-gated)
router.post('/forgot-password', otpLimiter, forgotPasswordHandler);
router.post('/verify-otp', otpLimiter, verifyOtpHandler);
router.post('/reset-password', otpLimiter, resetPasswordHandler);

export default router;
