import { Router } from 'express';
import {
    createPrescriptionHandler,
    getByConsultationHandler,
    getPrescriptionHandler,
    revokePrescriptionHandler,
} from './prescription.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';
import { idempotency } from '../../middleware/idempotency';

export const consultationPrescriptionRoutes = Router({ mergeParams: true });
consultationPrescriptionRoutes.use(authMiddleware);
consultationPrescriptionRoutes.post('/', requireRole('DOCTOR'), idempotency, createPrescriptionHandler);
consultationPrescriptionRoutes.get('/', getByConsultationHandler);

export const prescriptionRoutes = Router();
prescriptionRoutes.use(authMiddleware);
prescriptionRoutes.get('/:uuid', getPrescriptionHandler);
prescriptionRoutes.patch('/:uuid/revoke', requireRole('DOCTOR'), revokePrescriptionHandler);