import { Router } from 'express';
import {
    createDoctorHandler,
    searchDoctorsHandler,
    getDoctorHandler,
    updateDoctorHandler,
    verifyDoctorHandler,
} from './doctor.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', searchDoctorsHandler);
router.post('/', requireRole('DOCTOR'), createDoctorHandler);
router.get('/:uuid', getDoctorHandler);
router.patch('/:uuid', requireRole('DOCTOR', 'ADMIN'), updateDoctorHandler);
router.patch('/:uuid/verify', requireRole('ADMIN'), verifyDoctorHandler);

export default router;