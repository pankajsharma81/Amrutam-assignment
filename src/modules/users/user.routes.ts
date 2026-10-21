import { Router } from 'express';
import {
    listUsersHandler,
    getUserHandler,
    createUserHandler,
    updateUserHandler,
    deleteUserHandler,
} from './user.controller';
import { authMiddleware, requireRole } from '../../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);


router.get('/', requireRole('ADMIN', 'MANAGER'), listUsersHandler);

router.get('/:uuid', getUserHandler);

router.post('/', requireRole('ADMIN'), createUserHandler);

router.put('/:uuid', requireRole('ADMIN', 'MANAGER'), updateUserHandler);

router.delete('/:uuid', requireRole('ADMIN'), deleteUserHandler);

export default router;
