import { Router } from 'express';
import { authRoutes } from '../modules/auth';
import { userRoutes } from '../modules/users';
import { doctorRoutes } from '../modules/doctors';
import { doctorSlotRoutes, slotRoutes } from '../modules/slots';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/doctors', doctorRoutes);
router.use('/doctors/:uuid/slots', doctorSlotRoutes);
router.use('/slots', slotRoutes);

router.get('/health', (_req, res) => {
    res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

export default router;
