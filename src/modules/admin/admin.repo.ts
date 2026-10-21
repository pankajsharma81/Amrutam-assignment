import { Prisma, ConsultationStatus, PaymentStatus } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';

interface Range {
    start: Date;
    end: Date;
}

const countOf = (value: unknown): number => (value as { _all: number })._all;

export const AdminRepo = {
    listAuditLogs: (
        where: Prisma.audit_logsWhereInput,
        skip: number,
        take: number,
    ) => {
        return dbOperation(
            async () => {
                const [total, data] = await prisma.$transaction([
                    prisma.audit_logs.count({ where }),
                    prisma.audit_logs.findMany({
                        where,
                        skip,
                        take,
                        orderBy: { created_at: 'desc' },
                        select: {
                            id: true,
                            actor_id: true,
                            actor_role: true,
                            action: true,
                            resource: true,
                            resource_id: true,
                            ip_address: true,
                            request_id: true,
                            metadata: true,
                            created_at: true,
                        },
                    }),
                ]);
                return { total, data };
            },
            { operation: 'listAuditLogs', entity: 'AuditLog' },
        );
    },

    overview: (range: Range) => {
        const created = { gte: range.start, lt: range.end };
        return dbOperation(
            async () => {
                const [usersByRole, consultations, paid, refunded] = await Promise.all([
                    prisma.users.groupBy({
                        by: ['role'],
                        _count: { _all: true },
                        where: { is_deleted: false },
                    }),
                    prisma.consultations.count({ where: { created_at: created } }),
                    prisma.payments.aggregate({
                        _sum: { amount: true },
                        _count: { _all: true },
                        where: { status: PaymentStatus.SUCCEEDED, created_at: created },
                    }),
                    prisma.payments.aggregate({
                        _sum: { refunded_amount: true },
                        where: { created_at: created },
                    }),
                ]);
                return {
                    usersByRole: usersByRole.map((r) => ({
                        role: r.role,
                        count: countOf(r._count),
                    })),
                    consultations,
                    paidPayments: paid._count._all,
                    grossRevenue: Number(paid._sum.amount ?? 0),
                    refunded: Number(refunded._sum.refunded_amount ?? 0),
                };
            },
            { operation: 'overview', entity: 'Analytics' },
        );
    },

    funnel: (range: Range) => {
        return dbOperation(
            async () => {
                const rows = await prisma.consultations.groupBy({
                    by: ['status'],
                    _count: { _all: true },
                    where: { created_at: { gte: range.start, lt: range.end } },
                });
                return rows.map((r) => ({
                    status: r.status as ConsultationStatus,
                    count: countOf(r._count),
                }));
            },
            { operation: 'funnel', entity: 'Analytics' },
        );
    },

    topDoctors: (range: Range, limit: number) => {
        return dbOperation(
            async () => {
                const rows = await prisma.consultations.groupBy({
                    by: ['doctor_id'],
                    _count: { _all: true },
                    where: {
                        status: ConsultationStatus.COMPLETED,
                        created_at: { gte: range.start, lt: range.end },
                    },
                    orderBy: { _count: { doctor_id: 'desc' } },
                    take: limit,
                });
                const ids = rows.map((r) => r.doctor_id);
                const doctors = await prisma.doctors.findMany({
                    where: { id: { in: ids } },
                    select: {
                        id: true,
                        uuid: true,
                        specialization: true,
                        consultation_fee: true,
                        user: { select: { name: true } },
                    },
                });
                const byId = new Map(doctors.map((d) => [d.id, d]));
                return rows.map((r) => {
                    const d = byId.get(r.doctor_id);
                    const completed = countOf(r._count);
                    return {
                        doctor_uuid: d?.uuid ?? null,
                        name: d?.user.name ?? null,
                        specialization: d?.specialization ?? null,
                        completed,
                        revenue: Number(d?.consultation_fee ?? 0) * completed,
                    };
                });
            },
            { operation: 'topDoctors', entity: 'Analytics' },
        );
    },
};