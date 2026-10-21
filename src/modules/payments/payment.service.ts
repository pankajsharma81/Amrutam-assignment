import { randomUUID } from 'crypto';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { PaymentRepo } from './payment.repo';
import { ListPaymentsQuery, WebhookEvent } from './payment.schema';

interface Actor {
    id: number;
    uuid: string;
    user_type: string;
}

type PaymentRecord = NonNullable<Awaited<ReturnType<typeof PaymentRepo.findByUuid>>>;

const notFound = (what: string) => new AppError(`${what} not found`, HTTP_STATUS.NOT_FOUND);

const toView = (p: PaymentRecord) => ({
    uuid: p.uuid,
    consultation_uuid: p.consultation.uuid,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    refunded_amount: Number(p.refunded_amount),
    provider_ref: p.provider_ref,
    created_at: p.created_at,
    updated_at: p.updated_at,
});

export const PaymentService = {
    createIntent: async (actor: Actor, consultationUuid: string) => {
        const consultation = await PaymentRepo.findConsultation(consultationUuid);
        if (!consultation || consultation.patient.uuid !== actor.uuid) {
            throw notFound('Consultation');
        }
        if (consultation.status !== 'PENDING_PAYMENT') {
            throw new AppError(
                `Payment is not possible for a ${consultation.status} consultation`,
                HTTP_STATUS.CONFLICT,
            );
        }

        const existing = await PaymentRepo.findActiveByConsultation(consultation.id);
        if (existing) {
            if (existing.status === 'PENDING') return toView(existing);
            throw new AppError('Consultation is already paid', HTTP_STATUS.CONFLICT);
        }

        const created = await PaymentRepo.create(
            consultation.id,
            consultation.doctor.consultation_fee,
            `pay_${randomUUID().replace(/-/g, '')}`,
        );
        return toView(created);
    },

    handleWebhook: async (providerRef: string, event: WebhookEvent) => {
        const result = await PaymentRepo.applyWebhook(providerRef, event);
        if (result === 'UNKNOWN') throw notFound('Payment');
        return result;
    },

    get: async (actor: Actor, uuid: string) => {
        const payment = await PaymentRepo.findByUuid(uuid);
        const allowed =
            payment && (actor.user_type === 'ADMIN' || payment.consultation.patient.uuid === actor.uuid);
        if (!payment || !allowed) throw notFound('Payment');
        return toView(payment);
    },

    list: async (actor: Actor, query: ListPaymentsQuery) => {
        const result = await PaymentRepo.list(actor, query);
        return { ...result, data: result.data.map(toView) };
    },

    refund: async (uuid: string, requested?: number) => {
        const payment = await PaymentRepo.findByUuid(uuid);
        if (!payment) throw notFound('Payment');
        if (payment.status !== 'SUCCEEDED') {
            throw new AppError('Only succeeded payments can be refunded', HTTP_STATUS.CONFLICT);
        }

        const remaining = Math.round((Number(payment.amount) - Number(payment.refunded_amount)) * 100) / 100;
        const amount = requested ?? remaining;
        if (amount <= 0 || amount > remaining) {
            throw new AppError(
                `Refund amount must be between 0.01 and ${remaining}`,
                HTTP_STATUS.BAD_REQUEST,
            );
        }

        const ok = await PaymentRepo.refund(payment.id, amount);
        if (!ok) {
            throw new AppError('Payment state changed, please retry', HTTP_STATUS.CONFLICT);
        }

        const updated = await PaymentRepo.findByUuid(uuid);
        return toView(updated as PaymentRecord);
    },
};