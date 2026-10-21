import { Router } from 'express';
import {
    bookHandler,
    listHandler,
    getHandler,
    cancelHandler,
    rescheduleHandler,
    startHandler,
    completeHandler,
    notesHandler,
} from './consultation.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';
import { idempotency } from '../../middleware/idempotency';

const router = Router();

router.use(authMiddleware);

router.post('/', requireRole('PATIENT'), idempotency, bookHandler);
router.get('/', listHandler);
router.get('/:uuid', getHandler);
router.patch('/:uuid/cancel', cancelHandler);
router.patch('/:uuid/reschedule', requireRole('PATIENT', 'ADMIN'), rescheduleHandler);
router.patch('/:uuid/start', requireRole('DOCTOR'), startHandler);
router.patch('/:uuid/complete', requireRole('DOCTOR'), completeHandler);
router.put('/:uuid/notes', requireRole('DOCTOR'), notesHandler);

export default router;