import { Request } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { logError } from '../../utils/logger';

interface AuditEntry {
    actor?: { id: number; user_type?: string } | null;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
}

export const audit = async (req: Request, entry: AuditEntry): Promise<void> => {
    try {
        await prisma.audit_logs.create({
            data: {
                actor_id: entry.actor?.id ?? null,
                actor_role: entry.actor?.user_type ?? null,
                action: entry.action,
                resource: entry.resource,
                resource_id: entry.resourceId ?? null,
                ip_address: req.ip ?? null,
                request_id: req.get('x-request-id') ?? null,
                metadata: entry.metadata as Prisma.InputJsonValue | undefined,
            },
        });
    } catch (error) {
        logError('AUDIT', 'audit write failed', error, { action: entry.action });
    }
};