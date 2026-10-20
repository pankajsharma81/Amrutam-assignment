import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';
import { AUTH_CONSTANTS } from './auth.constants';

const ENTITY = 'User';

export const AuthRepo = {
    /**
     * Find a user by email, including password for auth comparison.
     */
    findByEmailWithPassword: (email: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { email, is_deleted: false },
            }),
            { operation: 'findByEmailWithPassword', entity: ENTITY },
        );
    },

    /**
     * Find a user by email (public fields only — no password).
     */
    findByEmail: (email: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { email, is_deleted: false },
                select: AUTH_CONSTANTS.SELECT,
            }),
            { operation: 'findByEmail', entity: ENTITY },
        );
    },

    /**
     * Find a user by UUID (public fields only).
     */
    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { uuid, is_deleted: false },
                select: AUTH_CONSTANTS.SELECT,
            }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    /**
     * Find a user by UUID including password (for change-password flow).
     */
    findByUuidWithPassword: (uuid: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { uuid, is_deleted: false },
                select: { uuid: true, password: true },
            }),
            { operation: 'findByUuidWithPassword', entity: ENTITY },
        );
    },

    /**
     * Update hashed password for a user by UUID.
     */
    updatePassword: (uuid: string, password: string) => {
        return dbOperation(
            () => prisma.users.update({
                where: { uuid },
                data: { password, updated_at: new Date() },
                select: AUTH_CONSTANTS.SELECT,
            }),
            { operation: 'updatePassword', entity: ENTITY },
        );
    },

    // ── Refresh sessions ──────────────────────────────────────

    createRefreshSession: (
        userId: number,
        sessionId: string,
        tokenHash: string,
        ipAddress?: string,
        userAgent?: string,
    ) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.create({
                data: {
                    user_id: userId,
                    session_id: sessionId,
                    token_hash: tokenHash,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                },
            }),
            { operation: 'createRefreshSession', entity: ENTITY },
        );
    },

    findRefreshSessionBySid: (sid: string) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.findUnique({
                where: { session_id: sid },
            }),
            { operation: 'findRefreshSessionBySid', entity: ENTITY },
        );
    },

    revokeRefreshSession: (sid: string, replacedBySession?: string) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.update({
                where: { session_id: sid },
                data: {
                    revoked_at: new Date(),
                    replaced_by_session: replacedBySession,
                    updated_at: new Date(),
                },
            }),
            { operation: 'revokeRefreshSession', entity: ENTITY },
        );
    },

    revokeAllSessionsByUserId: (userId: number) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.updateMany({
                where: { user_id: userId, revoked_at: null },
                data: { revoked_at: new Date(), updated_at: new Date() },
            }),
            { operation: 'revokeAllSessionsByUserId', entity: ENTITY },
        );
    },
};
