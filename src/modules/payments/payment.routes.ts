import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    intentHandler,
    webhookHandler,
    getHandler,
    listHandler,
    refundHandler,
} from './payment.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';
import { idempotency } from '../../middleware/idempotency';

const router = Router();

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    message: { success: false, message: 'Too many webhook requests.' },
});

router.post('/webhook', webhookLimiter, webhookHandler);

router.use(authMiddleware);

router.post('/intent', requireRole('PATIENT'), idempotency, intentHandler);
router.get('/', requireRole('PATIENT', 'ADMIN'), listHandler);
router.get('/:uuid', requireRole('PATIENT', 'ADMIN'), getHandler);
router.post('/:uuid/refund', requireRole('ADMIN'), idempotency, refundHandler);

export default router;