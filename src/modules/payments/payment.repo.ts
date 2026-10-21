import { Prisma } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';
import { ListPaymentsQuery, WebhookEvent } from './payment.schema';

const ENTITY = 'Payment';

const SELECT = {
    id: true,
    uuid: true,
    amount: true,
    currency: true,
    status: true,
    provider_ref: true,
    refunded_amount: true,
    created_at: true,
    updated_at: true,
    consultation: {
        select: { uuid: true, patient: { select: { uuid: true } } },
    },
} as const;

export type WebhookResult = 'UNKNOWN' | 'IGNORED' | 'FAILED' | 'CONFIRMED' | 'AUTO_REFUNDED';

export const PaymentRepo = {
    findConsultation: (uuid: string) => {
        return dbOperation(
            () => prisma.consultations.findUnique({
                where: { uuid },
                select: {
                    id: true,
                    status: true,
                    patient: { select: { uuid: true } },
                    doctor: { select: { consultation_fee: true } },
                },
            }),
            { operation: 'findConsultation', entity: 'Consultation' },
        );
    },

    findActiveByConsultation: (consultationId: number) => {
        return dbOperation(
            () => prisma.payments.findFirst({
                where: { consultation_id: consultationId, status: { in: ['PENDING', 'SUCCEEDED'] } },
                select: SELECT,
            }),
            { operation: 'findActiveByConsultation', entity: ENTITY },
        );
    },

    create: (consultationId: number, amount: Prisma.Decimal, providerRef: string) => {
        return dbOperation(
            () => prisma.payments.create({
                data: { consultation_id: consultationId, amount, provider_ref: providerRef },
                select: SELECT,
            }),
            { operation: 'create', entity: ENTITY },
        );
    },

    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.payments.findUnique({ where: { uuid }, select: SELECT }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    list: (actor: { id: number; user_type: string }, filters: ListPaymentsQuery) => {
        return dbOperation(
            async () => {
                const { status, page, limit } = filters;
                const where: Prisma.paymentsWhereInput = {
                    ...(actor.user_type === 'ADMIN' ? {} : { consultation: { patient_id: actor.id } }),
                    ...(status && { status }),
                };

                const [data, total] = await Promise.all([
                    prisma.payments.findMany({
                        where,
                        select: SELECT,
                        orderBy: { created_at: 'desc' },
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    prisma.payments.count({ where }),
                ]);
                return { data, total, page, limit };
            },
            { operation: 'list', entity: ENTITY },
        );
    },

    applyWebhook: (providerRef: string, event: WebhookEvent) => {
        return dbOperation(
            () => prisma.$transaction(async (tx): Promise<WebhookResult> => {
                const payment = await tx.payments.findUnique({
                    where: { provider_ref: providerRef },
                    select: { id: true, amount: true, consultation_id: true },
                });
                if (!payment) return 'UNKNOWN';

                if (event === 'payment.failed') {
                    const failed = await tx.payments.updateMany({
                        where: { id: payment.id, status: 'PENDING' },
                        data: { status: 'FAILED' },
                    });
                    return failed.count > 0 ? 'FAILED' : 'IGNORED';
                }

                const succeeded = await tx.payments.updateMany({
                    where: { id: payment.id, status: 'PENDING' },
                    data: { status: 'SUCCEEDED' },
                });
                if (succeeded.count === 0) return 'IGNORED';

                const confirmed = await tx.consultations.updateMany({
                    where: { id: payment.consultation_id, status: 'PENDING_PAYMENT' },
                    data: { status: 'CONFIRMED' },
                });
                if (confirmed.count === 0) {
                    await tx.payments.update({
                        where: { id: payment.id },
                        data: { status: 'REFUNDED', refunded_amount: payment.amount },
                    });
                    return 'AUTO_REFUNDED';
                }
                return 'CONFIRMED';
            }),
            { operation: 'applyWebhook', entity: ENTITY },
        );
    },

    refund: (id: number, amount: number) => {
        return dbOperation(
            async () => {
                const affected = await prisma.$executeRaw`
                    UPDATE "payments"
                    SET "refunded_amount" = "refunded_amount" + ${amount}::numeric,
                        "status" = CASE
                            WHEN "refunded_amount" + ${amount}::numeric >= "amount"
                            THEN 'REFUNDED'::"PaymentStatus"
                            ELSE "status"
                        END,
                        "updated_at" = now()
                    WHERE "id" = ${id}
                      AND "status" = 'SUCCEEDED'
                      AND "refunded_amount" + ${amount}::numeric <= "amount"
                `;
                return affected > 0;
            },
            { operation: 'refund', entity: ENTITY },
        );
    },
};