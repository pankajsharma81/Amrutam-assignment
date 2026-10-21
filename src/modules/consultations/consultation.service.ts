import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { decrypt, encrypt } from '../../shared/utils/crypto';
import { invalidateDoctorSlots } from '../slots/slot.service';
import { ConsultationRepo } from './consultation.repo';
import { ListConsultationsQuery } from './consultation.schema';

interface Actor {
    id: number;
    uuid: string;
    user_type: string;
}

const START_EARLY_MS = 10 * 60 * 1000;

const notFound = () => new AppError('Consultation not found', HTTP_STATUS.NOT_FOUND);
const doctorOnly = () =>
    new AppError('Only the consulting doctor can do this', HTTP_STATUS.FORBIDDEN);

const load = async (actor: Actor, uuid: string) => {
    const c = await ConsultationRepo.findByUuid(uuid);
    if (!c) throw notFound();

    const isPatient = c.patient.uuid === actor.uuid;
    const isDoctor = c.doctor.user.uuid === actor.uuid;
    const isAdmin = actor.user_type === 'ADMIN';
    if (!isPatient && !isDoctor && !isAdmin) throw notFound();

    return { c, isPatient, isDoctor, isAdmin };
};

export const ConsultationService = {
    book: async (actor: Actor, slotUuid: string) => {
        const consultation = await ConsultationRepo.book(actor.id, slotUuid);
        await invalidateDoctorSlots(consultation.doctor.uuid);
        return consultation;
    },

    list: (actor: Actor, query: ListConsultationsQuery) => ConsultationRepo.list(actor, query),

    get: async (actor: Actor, uuid: string) => {
        const { c, isDoctor } = await load(actor, uuid);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, slot_id, doctor_id, notes_enc, ...view } = c;
        return {
            ...view,
            ...(isDoctor && { notes: notes_enc ? decrypt(notes_enc) : null }),
        };
    },

    cancel: async (actor: Actor, uuid: string, reason?: string) => {
        const { c } = await load(actor, uuid);
        const ok = await ConsultationRepo.cancel(c.id, c.slot_id, reason);
        if (!ok) {
            throw new AppError(
                `Consultation cannot be cancelled in ${c.status} state`,
                HTTP_STATUS.CONFLICT,
            );
        }
        await invalidateDoctorSlots(c.doctor.uuid);
        return { uuid, status: 'CANCELLED' };
    },

    reschedule: async (actor: Actor, uuid: string, newSlotUuid: string) => {
        const { c } = await load(actor, uuid);
        const updated = await ConsultationRepo.reschedule(c, newSlotUuid);
        await invalidateDoctorSlots(c.doctor.uuid);
        return updated;
    },

    start: async (actor: Actor, uuid: string) => {
        const { c, isDoctor } = await load(actor, uuid);
        if (!isDoctor) throw doctorOnly();

        const now = Date.now();
        if (now < c.scheduled_start.getTime() - START_EARLY_MS) {
            throw new AppError('Too early to start this consultation', HTTP_STATUS.CONFLICT);
        }
        if (now >= c.scheduled_end.getTime()) {
            throw new AppError('Consultation time has already ended', HTTP_STATUS.CONFLICT);
        }

        const ok = await ConsultationRepo.transition(c.id, 'CONFIRMED', 'IN_PROGRESS', {
            started_at: new Date(),
        });
        if (!ok) {
            throw new AppError(
                `Consultation cannot be started in ${c.status} state`,
                HTTP_STATUS.CONFLICT,
            );
        }
        return { uuid, status: 'IN_PROGRESS' };
    },

    complete: async (actor: Actor, uuid: string) => {
        const { c, isDoctor } = await load(actor, uuid);
        if (!isDoctor) throw doctorOnly();

        const ok = await ConsultationRepo.transition(c.id, 'IN_PROGRESS', 'COMPLETED', {
            completed_at: new Date(),
        });
        if (!ok) {
            throw new AppError(
                `Consultation cannot be completed in ${c.status} state`,
                HTTP_STATUS.CONFLICT,
            );
        }
        return { uuid, status: 'COMPLETED' };
    },

    saveNotes: async (actor: Actor, uuid: string, notes: string) => {
        const { c, isDoctor } = await load(actor, uuid);
        if (!isDoctor) throw doctorOnly();

        const ok = await ConsultationRepo.saveNotes(c.id, encrypt(notes));
        if (!ok) {
            throw new AppError(
                'Notes can be saved only after the consultation has started',
                HTTP_STATUS.CONFLICT,
            );
        }
        return { uuid };
    },
};