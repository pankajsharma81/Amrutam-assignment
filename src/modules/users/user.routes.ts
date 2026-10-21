import { Router } from 'express';
import {
    getMeHandler,
    updateMeHandler,
    listUsersHandler,
    getUserHandler,
    updateRoleHandler,
    deleteUserHandler,
} from './user.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/me', getMeHandler);
router.patch('/me', updateMeHandler);

router.get('/', requireRole('ADMIN'), listUsersHandler);
router.get('/:uuid', requireRole('ADMIN'), getUserHandler);
router.patch('/:uuid/role', requireRole('ADMIN'), updateRoleHandler);
router.delete('/:uuid', requireRole('ADMIN'), deleteUserHandler);

export default router;