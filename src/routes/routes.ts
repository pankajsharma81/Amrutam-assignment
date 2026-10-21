import { Router } from 'express';
import { authRoutes } from '../modules/auth';
import { userRoutes } from '../modules/users';
import { doctorRoutes } from '../modules/doctors';
import { doctorSlotRoutes, slotRoutes } from '../modules/slots';
import { consultationRoutes } from '../modules/consultations';
import { consultationPrescriptionRoutes, prescriptionRoutes } from '../modules/prescriptions';
import { paymentRoutes } from '../modules/payments';
import prisma from '../config/prismaClient';
import { getRedisClient } from '../config/redis';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/doctors', doctorRoutes);

router.use('/doctors/:uuid/slots', doctorSlotRoutes);
router.use('/slots', slotRoutes);

router.use('/consultations', consultationRoutes);

router.use('/consultations/:uuid/prescription', consultationPrescriptionRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/consultations', consultationRoutes);

router.use('/payments', paymentRoutes);

router.get('/health', (_req, res) => {
    res.json({ success: true, message: 'OK', timestamp: new Date().toISOString() });
});

const withTimeout = <T>(p: Promise<T>, ms = 2000): Promise<T> =>
    Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

router.get('/health/live', (_req, res) => {
    res.json({ success: true, status: 'live' });
});

router.get('/health/ready', async (_req, res) => {
    const checks = { database: 'down', redis: 'down' };

    try {
        await withTimeout(prisma.$queryRaw`SELECT 1`);
        checks.database = 'up';
    } catch {
        // stays down
    }

    try {
        const pong = await withTimeout(getRedisClient().ping());
        if (pong === 'PONG') checks.redis = 'up';
    } catch {
        // stays down
    }

    const ready = checks.database === 'up' && checks.redis === 'up';
    res.status(ready ? 200 : 503).json({
        success: ready,
        status: ready ? 'ready' : 'not_ready',
        checks,
    });
});

export default router;
