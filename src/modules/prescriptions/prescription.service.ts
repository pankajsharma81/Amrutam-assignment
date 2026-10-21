import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { decrypt, encrypt } from '../../shared/utils/crypto';
import { PrescriptionRepo } from './prescription.repo';
import { CreatePrescriptionInput } from './prescription.schema';

interface Actor {
    id: number;
    uuid: string;
    user_type: string;
}

type PrescriptionRecord = NonNullable<Awaited<ReturnType<typeof PrescriptionRepo.findByUuid>>>;

const consultationNotFound = () => new AppError('Consultation not found', HTTP_STATUS.NOT_FOUND);
const prescriptionNotFound = () => new AppError('Prescription not found', HTTP_STATUS.NOT_FOUND);

const isParticipant = (
    c: { patient: { uuid: string }; doctor: { user: { uuid: string } } },
    actor: Actor,
) => c.patient.uuid === actor.uuid || c.doctor.user.uuid === actor.uuid;

const toView = (p: PrescriptionRecord) => ({
    uuid: p.uuid,
    consultation_uuid: p.consultation.uuid,
    status: p.revoked_at ? 'REVOKED' : 'ACTIVE',
    medications: JSON.parse(decrypt(p.medications_enc)),
    instructions: p.instructions_enc ? decrypt(p.instructions_enc) : null,
    revoked_at: p.revoked_at,
    revoked_reason: p.revoked_reason,
    created_at: p.created_at,
});

export const PrescriptionService = {
    create: async (actor: Actor, consultationUuid: string, input: CreatePrescriptionInput) => {
        const consultation = await PrescriptionRepo.findConsultation(consultationUuid);
        if (!consultation || consultation.doctor.user.uuid !== actor.uuid) {
            throw consultationNotFound();
        }
        if (consultation.status !== 'IN_PROGRESS' && consultation.status !== 'COMPLETED') {
            throw new AppError(
                'Prescription can be issued only after the consultation has started',
                HTTP_STATUS.CONFLICT,
            );
        }

        const created = await PrescriptionRepo.create(
            consultation.id,
            encrypt(JSON.stringify(input.medications)),
            input.instructions ? encrypt(input.instructions) : null,
        );
        return toView(created);
    },

    getByConsultation: async (actor: Actor, consultationUuid: string) => {
        const consultation = await PrescriptionRepo.findConsultation(consultationUuid);
        if (!consultation || !isParticipant(consultation, actor)) throw consultationNotFound();

        const prescription = await PrescriptionRepo.findActiveByConsultation(consultation.id);
        if (!prescription) throw prescriptionNotFound();
        return toView(prescription);
    },

    getByUuid: async (actor: Actor, uuid: string) => {
        const prescription = await PrescriptionRepo.findByUuid(uuid);
        if (!prescription || !isParticipant(prescription.consultation, actor)) {
            throw prescriptionNotFound();
        }
        return toView(prescription);
    },

    revoke: async (actor: Actor, uuid: string, reason: string) => {
        const prescription = await PrescriptionRepo.findByUuid(uuid);
        if (!prescription || prescription.consultation.doctor.user.uuid !== actor.uuid) {
            throw prescriptionNotFound();
        }

        const ok = await PrescriptionRepo.revoke(prescription.id, reason);
        if (!ok) throw new AppError('Prescription is already revoked', HTTP_STATUS.CONFLICT);
        return { uuid, status: 'REVOKED' };
    },
};