import { ConsultationStatus, Prisma, SlotStatus } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { ListConsultationsQuery } from './consultation.schema';

const ENTITY = 'Consultation';

const VIEW = {
    uuid: true,
    status: true,
    scheduled_start: true,
    scheduled_end: true,
    started_at: true,
    completed_at: true,
    cancelled_at: true,
    cancel_reason: true,
    created_at: true,
    patient: { select: { uuid: true, name: true } },
    doctor: {
        select: {
            uuid: true,
            specialization: true,
            user: { select: { uuid: true, name: true } },
        },
    },
    slot: { select: { uuid: true } },
} as const;

const ACCESS = {
    ...VIEW,
    id: true,
    slot_id: true,
    doctor_id: true,
    notes_enc: true,
} as const;

const CANCELLABLE: ConsultationStatus[] = ['PENDING_PAYMENT', 'CONFIRMED'];

const claimSlot = (
    tx: Prisma.TransactionClient,
    where: Prisma.availability_slotsWhereInput,
) =>
    tx.availability_slots.updateMany({
        where: {
            ...where,
            status: SlotStatus.AVAILABLE,
            start_time: { gt: new Date() },
            doctor: { verified: true },
        },
        data: { status: SlotStatus.BOOKED },
    });

const slotTaken = () => new AppError('Slot is not available', HTTP_STATUS.CONFLICT);

export const ConsultationRepo = {
    book: (patientId: number, slotUuid: string) => {
        return dbOperation(
            () => prisma.$transaction(async (tx) => {
                const claimed = await claimSlot(tx, { uuid: slotUuid });
                if (claimed.count === 0) throw slotTaken();

                const slot = await tx.availability_slots.findUniqueOrThrow({
                    where: { uuid: slotUuid },
                    select: { id: true, doctor_id: true, start_time: true, end_time: true },
                });

                return tx.consultations.create({
                    data: {
                        patient_id: patientId,
                        doctor_id: slot.doctor_id,
                        slot_id: slot.id,
                        scheduled_start: slot.start_time,
                        scheduled_end: slot.end_time,
                    },
                    select: VIEW,
                });
            }),
            { operation: 'book', entity: ENTITY },
        );
    },

    list: (
        actor: { id: number; user_type: string },
        filters: ListConsultationsQuery,
    ) => {
        return dbOperation(
            async () => {
                const { status, from, to, page, limit } = filters;

                const scope: Prisma.consultationsWhereInput =
                    actor.user_type === 'ADMIN'
                        ? {}
                        : actor.user_type === 'DOCTOR'
                          ? { doctor: { user_id: actor.id } }
                          : { patient_id: actor.id };

                const where: Prisma.consultationsWhereInput = {
                    ...scope,
                    ...(status && { status }),
                    ...((from || to) && { scheduled_start: { gte: from, lte: to } }),
                };

                const [data, total] = await Promise.all([
                    prisma.consultations.findMany({
                        where,
                        select: VIEW,
                        orderBy: { scheduled_start: 'desc' },
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    prisma.consultations.count({ where }),
                ]);
                return { data, total, page, limit };
            },
            { operation: 'list', entity: ENTITY },
        );
    },

    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.consultations.findUnique({ where: { uuid }, select: ACCESS }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    cancel: (id: number, slotId: number, reason?: string) => {
        return dbOperation(
            () => prisma.$transaction(async (tx) => {
                const res = await tx.consultations.updateMany({
                    where: { id, status: { in: CANCELLABLE } },
                    data: {
                        status: 'CANCELLED',
                        cancelled_at: new Date(),
                        cancel_reason: reason,
                    },
                });
                if (res.count === 0) return false;

                await tx.availability_slots.updateMany({
                    where: { id: slotId, status: SlotStatus.BOOKED },
                    data: { status: SlotStatus.AVAILABLE },
                });
                return true;
            }),
            { operation: 'cancel', entity: ENTITY },
        );
    },

    reschedule: (
        c: { id: number; slot_id: number; doctor_id: number },
        newSlotUuid: string,
    ) => {
        return dbOperation(
            () => prisma.$transaction(async (tx) => {
                const claimed = await claimSlot(tx, { uuid: newSlotUuid, doctor_id: c.doctor_id });
                if (claimed.count === 0) throw slotTaken();

                const slot = await tx.availability_slots.findUniqueOrThrow({
                    where: { uuid: newSlotUuid },
                    select: { id: true, start_time: true, end_time: true },
                });

                const moved = await tx.consultations.updateMany({
                    where: { id: c.id, slot_id: c.slot_id, status: { in: CANCELLABLE } },
                    data: {
                        slot_id: slot.id,
                        scheduled_start: slot.start_time,
                        scheduled_end: slot.end_time,
                    },
                });
                if (moved.count === 0) {
                    throw new AppError(
                        'Consultation cannot be rescheduled in its current state',
                        HTTP_STATUS.CONFLICT,
                    );
                }

                await tx.availability_slots.updateMany({
                    where: { id: c.slot_id, status: SlotStatus.BOOKED },
                    data: { status: SlotStatus.AVAILABLE },
                });

                return tx.consultations.findUniqueOrThrow({
                    where: { id: c.id },
                    select: VIEW,
                });
            }),
            { operation: 'reschedule', entity: ENTITY },
        );
    },

    transition: (
        id: number,
        from: ConsultationStatus,
        to: ConsultationStatus,
        extra: Prisma.consultationsUpdateManyMutationInput = {},
    ) => {
        return dbOperation(
            async () => {
                const res = await prisma.consultations.updateMany({
                    where: { id, status: from },
                    data: { status: to, ...extra },
                });
                return res.count > 0;
            },
            { operation: 'transition', entity: ENTITY },
        );
    },

    saveNotes: (id: number, notesEnc: string) => {
        return dbOperation(
            async () => {
                const res = await prisma.consultations.updateMany({
                    where: { id, status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
                    data: { notes_enc: notesEnc },
                });
                return res.count > 0;
            },
            { operation: 'saveNotes', entity: ENTITY },
        );
    },
};