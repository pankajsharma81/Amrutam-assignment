import { UserRole } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';
import { AUTH_CONSTANTS } from './auth.constants';

const ENTITY = 'User';
const SESSION = 'Session';

export const AuthRepo = {
    findByEmailWithPassword: (email: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { email, is_deleted: false },
            }),
            { operation: 'findByEmailWithPassword', entity: ENTITY },
        );
    },

    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { uuid, is_deleted: false },
                select: AUTH_CONSTANTS.SELECT,
            }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    findByUuidWithPassword: (uuid: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { uuid, is_deleted: false },
                select: { uuid: true, password: true },
            }),
            { operation: 'findByUuidWithPassword', entity: ENTITY },
        );
    },

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

    createUserWithVerificationToken: (
        data: {
            email: string;
            name: string;
            password: string;
            phone?: string;
            role: UserRole;
        },
        tokenHash: string,
        expiresAt: Date,
    ) => {
        return dbOperation(
            () => prisma.users.create({
                data: {
                    ...data,
                    email_tokens: {
                        create: { token_hash: tokenHash, expires_at: expiresAt },
                    },
                },
                select: AUTH_CONSTANTS.SELECT,
            }),
            { operation: 'createUserWithVerificationToken', entity: ENTITY },
        );
    },

    recordFailedLogin: (userId: number, maxAttempts: number, lockMinutes: number) => {
        return dbOperation(
            async () => {
                const updated = await prisma.users.update({
                    where: { id: userId },
                    data: { failed_login_count: { increment: 1 } },
                    select: { failed_login_count: true },
                });
                if (updated.failed_login_count >= maxAttempts) {
                    await prisma.users.update({
                        where: { id: userId },
                        data: {
                            locked_until: new Date(Date.now() + lockMinutes * 60 * 1000),
                            failed_login_count: 0,
                        },
                    });
                }
            },
            { operation: 'recordFailedLogin', entity: ENTITY },
        );
    },

    recordSuccessfulLogin: (userId: number) => {
        return dbOperation(
            () => prisma.users.update({
                where: { id: userId },
                data: { failed_login_count: 0, locked_until: null, last_login_at: new Date() },
            }),
            { operation: 'recordSuccessfulLogin', entity: ENTITY },
        );
    },

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
            { operation: 'createRefreshSession', entity: SESSION },
        );
    },

    findRefreshSessionBySid: (sid: string) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.findUnique({
                where: { session_id: sid },
            }),
            { operation: 'findRefreshSessionBySid', entity: SESSION },
        );
    },

    revokeRefreshSession: (sid: string, replacedBySession?: string) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.updateMany({
                where: { session_id: sid, revoked_at: null },
                data: {
                    revoked_at: new Date(),
                    replaced_by_session: replacedBySession,
                    updated_at: new Date(),
                },
            }),
            { operation: 'revokeRefreshSession', entity: SESSION },
        );
    },

    revokeAllSessionsByUserId: (userId: number) => {
        return dbOperation(
            () => prisma.user_refresh_sessions.updateMany({
                where: { user_id: userId, revoked_at: null },
                data: { revoked_at: new Date(), updated_at: new Date() },
            }),
            { operation: 'revokeAllSessionsByUserId', entity: SESSION },
        );
    },

    rotateRefreshSession: (
        oldSid: string,
        userId: number,
        newSid: string,
        newTokenHash: string,
        ipAddress?: string,
        userAgent?: string,
    ) => {
        return dbOperation(
            () => prisma.$transaction(async (tx) => {
                const revoked = await tx.user_refresh_sessions.updateMany({
                    where: { session_id: oldSid, revoked_at: null },
                    data: {
                        revoked_at: new Date(),
                        replaced_by_session: newSid,
                        updated_at: new Date(),
                    },
                });
                if (revoked.count === 0) return false;

                await tx.user_refresh_sessions.create({
                    data: {
                        user_id: userId,
                        session_id: newSid,
                        token_hash: newTokenHash,
                        ip_address: ipAddress,
                        user_agent: userAgent,
                    },
                });
                return true;
            }),
            { operation: 'rotateRefreshSession', entity: SESSION },
        );
    },

    findMfaStateByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.users.findFirst({
                where: { uuid, is_deleted: false },
                select: {
                    id: true,
                    uuid: true,
                    email: true,
                    role: true,
                    is_active: true,
                    mfa_enabled: true,
                    mfa_secret_enc: true,
                    locked_until: true,
                },
            }),
            { operation: 'findMfaStateByUuid', entity: ENTITY },
        );
    },

    setMfaSecret: (userId: number, secretEnc: string) => {
        return dbOperation(
            () => prisma.users.update({
                where: { id: userId },
                data: { mfa_secret_enc: secretEnc, mfa_enabled: false },
                select: { id: true },
            }),
            { operation: 'setMfaSecret', entity: ENTITY },
        );
    },

    enableMfa: (userId: number) => {
        return dbOperation(
            () => prisma.users.update({
                where: { id: userId },
                data: { mfa_enabled: true },
                select: { id: true },
            }),
            { operation: 'enableMfa', entity: ENTITY },
        );
    },
};