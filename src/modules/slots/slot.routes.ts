import { Router } from 'express';
import {
    createSlotsHandler,
    listSlotsHandler,
    updateSlotHandler,
    deleteSlotHandler,
} from './slot.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';

export const doctorSlotRoutes = Router({ mergeParams: true });
doctorSlotRoutes.use(authMiddleware);
doctorSlotRoutes.post('/', requireRole('DOCTOR', 'ADMIN'), createSlotsHandler);
doctorSlotRoutes.get('/', listSlotsHandler);

export const slotRoutes = Router();
slotRoutes.use(authMiddleware);
slotRoutes.patch('/:uuid', requireRole('DOCTOR', 'ADMIN'), updateSlotHandler);
slotRoutes.delete('/:uuid', requireRole('DOCTOR', 'ADMIN'), deleteSlotHandler);