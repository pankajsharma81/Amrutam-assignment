import { SlotStatus } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';

const ENTITY = 'Slot';

export const SlotRepo = {
    findDoctor: (uuid: string) => {
        return dbOperation(
            () => prisma.doctors.findUnique({
                where: { uuid },
                select: { id: true, verified: true, user: { select: { uuid: true } } },
            }),
            { operation: 'findDoctor', entity: 'Doctor' },
        );
    },

    findSlot: (uuid: string) => {
        return dbOperation(
            () => prisma.availability_slots.findUnique({
                where: { uuid },
                select: {
                    uuid: true,
                    status: true,
                    doctor: { select: { uuid: true, user: { select: { uuid: true } } } },
                },
            }),
            { operation: 'findSlot', entity: ENTITY },
        );
    },

    hasOverlap: (doctorId: number, start: Date, end: Date) => {
        return dbOperation(
            async () => {
                const found = await prisma.availability_slots.findFirst({
                    where: { doctor_id: doctorId, start_time: { lt: end }, end_time: { gt: start } },
                    select: { id: true },
                });
                return found !== null;
            },
            { operation: 'hasOverlap', entity: ENTITY },
        );
    },

    createMany: (slots: { doctor_id: number; start_time: Date; end_time: Date }[]) => {
        return dbOperation(
            async () => {
                const result = await prisma.availability_slots.createMany({
                    data: slots,
                    skipDuplicates: true,
                });
                return result.count;
            },
            { operation: 'createMany', entity: ENTITY },
        );
    },

    listAvailable: (doctorId: number, start: Date, end: Date) => {
        return dbOperation(
            () => prisma.availability_slots.findMany({
                where: {
                    doctor_id: doctorId,
                    status: SlotStatus.AVAILABLE,
                    start_time: { gte: start, lt: end },
                },
                select: { uuid: true, start_time: true, end_time: true, status: true },
                orderBy: { start_time: 'asc' },
            }),
            { operation: 'listAvailable', entity: ENTITY },
        );
    },

    updateStatusIfNotBooked: (uuid: string, status: SlotStatus) => {
        return dbOperation(
            async () => {
                const result = await prisma.availability_slots.updateMany({
                    where: { uuid, status: { not: SlotStatus.BOOKED } },
                    data: { status },
                });
                return result.count;
            },
            { operation: 'updateStatusIfNotBooked', entity: ENTITY },
        );
    },

    deleteIfNotBooked: (uuid: string) => {
        return dbOperation(
            async () => {
                const result = await prisma.availability_slots.deleteMany({
                    where: { uuid, status: { not: SlotStatus.BOOKED } },
                });
                return result.count;
            },
            { operation: 'deleteIfNotBooked', entity: ENTITY },
        );
    },
};