import { Router } from 'express';
import {
    auditLogsHandler,
    overviewHandler,
    funnelHandler,
    doctorsHandler,
} from './admin.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware, requireRole('ADMIN'));

router.get('/audit-logs', auditLogsHandler);
router.get('/analytics/overview', overviewHandler);
router.get('/analytics/doctors', doctorsHandler);
router.get('/analytics/funnel', funnelHandler);

export default router;