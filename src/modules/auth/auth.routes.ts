import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    registerHandler,
    loginHandler,
    refreshTokenHandler,
    logoutHandler,
    logoutAllHandler,
    changePasswordHandler,
    mfaEnrollHandler,
    mfaConfirmHandler,
    mfaVerifyHandler,
} from './auth.controller';
import { authMiddleware } from '../../middleware/authMiddleware';

const router = Router();

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

const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many refresh attempts, please try again after 15 minutes.' },
});

const mfaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many MFA attempts, please try again later.' },
});

router.post('/register', registerLimiter, registerHandler);
router.post('/login', loginLimiter, loginHandler);
router.post('/refresh-token', refreshLimiter, refreshTokenHandler);
router.post('/refresh', refreshLimiter, refreshTokenHandler);
router.post('/logout', logoutHandler);

router.post('/mfa/enroll', authMiddleware, mfaLimiter, mfaEnrollHandler);
router.post('/mfa/confirm', authMiddleware, mfaLimiter, mfaConfirmHandler);
router.post('/mfa/verify', mfaLimiter, mfaVerifyHandler);

router.post('/logout-all', authMiddleware, logoutAllHandler);
router.post('/change-password', authMiddleware, changePasswordHandler);

export default router;