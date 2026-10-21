import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';

const ENTITY = 'Prescription';

const SELECT = {
    id: true,
    uuid: true,
    medications_enc: true,
    instructions_enc: true,
    revoked_at: true,
    revoked_reason: true,
    created_at: true,
    consultation: {
        select: {
            uuid: true,
            status: true,
            patient: { select: { uuid: true } },
            doctor: { select: { user: { select: { uuid: true } } } },
        },
    },
} as const;

export const PrescriptionRepo = {
    findConsultation: (uuid: string) => {
        return dbOperation(
            () => prisma.consultations.findUnique({
                where: { uuid },
                select: {
                    id: true,
                    status: true,
                    patient: { select: { uuid: true } },
                    doctor: { select: { user: { select: { uuid: true } } } },
                },
            }),
            { operation: 'findConsultation', entity: 'Consultation' },
        );
    },

    create: (consultationId: number, medicationsEnc: string, instructionsEnc: string | null) => {
        return dbOperation(
            () => prisma.prescriptions.create({
                data: {
                    consultation_id: consultationId,
                    medications_enc: medicationsEnc,
                    instructions_enc: instructionsEnc,
                },
                select: SELECT,
            }),
            { operation: 'create', entity: ENTITY },
        );
    },

    findActiveByConsultation: (consultationId: number) => {
        return dbOperation(
            () => prisma.prescriptions.findFirst({
                where: { consultation_id: consultationId, revoked_at: null },
                select: SELECT,
            }),
            { operation: 'findActiveByConsultation', entity: ENTITY },
        );
    },

    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.prescriptions.findUnique({ where: { uuid }, select: SELECT }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    revoke: (id: number, reason: string) => {
        return dbOperation(
            async () => {
                const res = await prisma.prescriptions.updateMany({
                    where: { id, revoked_at: null },
                    data: { revoked_at: new Date(), revoked_reason: reason },
                });
                return res.count > 0;
            },
            { operation: 'revoke', entity: ENTITY },
        );
    },
};