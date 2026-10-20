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

// All user routes require authentication
router.use(authMiddleware);

// ── CRUD endpoints ────────────────────────────────────────────

// GET  /v1/users         — list users (ADMIN, MANAGER)
router.get('/', requireRole('ADMIN', 'MANAGER'), listUsersHandler);

// GET  /v1/users/:uuid   — get single user
router.get('/:uuid', getUserHandler);

// POST /v1/users         — create user (ADMIN only)
router.post('/', requireRole('ADMIN'), createUserHandler);

// PUT  /v1/users/:uuid   — update user (ADMIN, MANAGER)
router.put('/:uuid', requireRole('ADMIN', 'MANAGER'), updateUserHandler);

// DELETE /v1/users/:uuid — soft-delete user (ADMIN only)
router.delete('/:uuid', requireRole('ADMIN'), deleteUserHandler);

export default router;
