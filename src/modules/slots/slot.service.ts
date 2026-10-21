import { SlotStatus } from '@prisma/client';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { cacheBumpVersion, cacheGet, cacheGetVersion, cacheSet } from '../../shared/utils/cache';
import { SlotRepo } from './slot.repo';
import { CreateSlotsInput, ListSlotsQuery } from './slot.schema';

interface Actor {
    id: number;
    uuid: string;
    user_type: string;
}

const CACHE_TTL_SECONDS = 60;
const MAX_RANGE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const versionKey = (doctorUuid: string) => `slots:ver:${doctorUuid}`;

export const invalidateDoctorSlots = (doctorUuid: string) =>
    cacheBumpVersion(versionKey(doctorUuid));

const canManage = (actor: Actor, ownerUuid: string) =>
    actor.user_type === 'ADMIN' || actor.uuid === ownerUuid;

const notFound = (what: string) => new AppError(`${what} not found`, HTTP_STATUS.NOT_FOUND);

const forbidden = () =>
    new AppError('You can only manage your own slots', HTTP_STATUS.FORBIDDEN);

const resolveRange = (query: ListSlotsQuery) => {
    const today = new Date().toISOString().slice(0, 10);
    const from = query.from ?? today;
    const to = query.to ?? new Date(Date.parse(from) + 6 * DAY_MS).toISOString().slice(0, 10);

    const start = Date.parse(`${from}T00:00:00.000Z`);
    const end = Date.parse(`${to}T00:00:00.000Z`) + DAY_MS;

    if (end <= start) {
        throw new AppError('"to" must not be before "from"', HTTP_STATUS.BAD_REQUEST);
    }
    if ((end - start) / DAY_MS > MAX_RANGE_DAYS) {
        throw new AppError(`Range cannot exceed ${MAX_RANGE_DAYS} days`, HTTP_STATUS.BAD_REQUEST);
    }
    return { from, to, start: new Date(Math.max(start, Date.now())), end: new Date(end) };
};

export const SlotService = {
    create: async (actor: Actor, doctorUuid: string, input: CreateSlotsInput) => {
        const doctor = await SlotRepo.findDoctor(doctorUuid);
        if (!doctor) throw notFound('Doctor');
        if (!canManage(actor, doctor.user.uuid)) throw forbidden();
        if (!doctor.verified) {
            throw new AppError('Doctor is not verified yet', HTTP_STATUS.FORBIDDEN);
        }

        const slotMs = input.slot_minutes * 60000;
        const count = Math.floor((input.end_time.getTime() - input.start_time.getTime()) / slotMs);
        const slots = Array.from({ length: count }, (_, i) => {
            const start = new Date(input.start_time.getTime() + i * slotMs);
            return {
                doctor_id: doctor.id,
                start_time: start,
                end_time: new Date(start.getTime() + slotMs),
            };
        });

        const rangeEnd = slots[slots.length - 1].end_time;
        if (await SlotRepo.hasOverlap(doctor.id, input.start_time, rangeEnd)) {
            throw new AppError('Slots overlap with existing slots', HTTP_STATUS.CONFLICT);
        }

        const created = await SlotRepo.createMany(slots);
        await invalidateDoctorSlots(doctorUuid);
        return { requested: slots.length, created };
    },

    list: async (actor: Actor, doctorUuid: string, query: ListSlotsQuery) => {
        const doctor = await SlotRepo.findDoctor(doctorUuid);
        if (!doctor || (!doctor.verified && !canManage(actor, doctor.user.uuid))) {
            throw notFound('Doctor');
        }

        const range = resolveRange(query);
        const version = await cacheGetVersion(versionKey(doctorUuid));
        const key = `slots:${doctorUuid}:${version}:${range.from}:${range.to}`;

        const cached = await cacheGet<{ from: string; to: string; data: unknown[] }>(key);
        if (cached) return cached;

        const data = await SlotRepo.listAvailable(doctor.id, range.start, range.end);
        const result = { from: range.from, to: range.to, data };
        await cacheSet(key, result, CACHE_TTL_SECONDS);
        return result;
    },

    updateStatus: async (actor: Actor, slotUuid: string, status: SlotStatus) => {
        const slot = await SlotRepo.findSlot(slotUuid);
        if (!slot) throw notFound('Slot');
        if (!canManage(actor, slot.doctor.user.uuid)) throw forbidden();

        const updated = await SlotRepo.updateStatusIfNotBooked(slotUuid, status);
        if (updated === 0) {
            throw new AppError('A booked slot cannot be changed', HTTP_STATUS.CONFLICT);
        }
        await invalidateDoctorSlots(slot.doctor.uuid);
        return { uuid: slotUuid, status };
    },

    remove: async (actor: Actor, slotUuid: string) => {
        const slot = await SlotRepo.findSlot(slotUuid);
        if (!slot) throw notFound('Slot');
        if (!canManage(actor, slot.doctor.user.uuid)) throw forbidden();

        const deleted = await SlotRepo.deleteIfNotBooked(slotUuid);
        if (deleted === 0) {
            throw new AppError('A booked slot cannot be deleted', HTTP_STATUS.CONFLICT);
        }
        await invalidateDoctorSlots(slot.doctor.uuid);
    },
};