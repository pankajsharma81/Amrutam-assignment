import { Prisma, SlotStatus } from '@prisma/client';
import prisma from '../../config/prismaClient';
import { dbOperation } from '../../shared/utils/dbOperation';
import { CreateDoctorInput, DoctorSearchQuery, UpdateDoctorInput } from './doctor.schema';

const ENTITY = 'Doctor';

const SELECT = {
    uuid: true,
    specialization: true,
    experience_years: true,
    consultation_fee: true,
    languages: true,
    bio: true,
    rating: true,
    verified: true,
    created_at: true,
    user: { select: { uuid: true, name: true } },
} as const;

const ORDER: Record<DoctorSearchQuery['sort'], Prisma.doctorsOrderByWithRelationInput> = {
    rating: { rating: 'desc' },
    fee_asc: { consultation_fee: 'asc' },
    fee_desc: { consultation_fee: 'desc' },
    experience: { experience_years: 'desc' },
};

const dayRange = (day: string) => {
    const start = new Date(`${day}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { gte: new Date(Math.max(start.getTime(), Date.now())), lt: end };
};

export const DoctorRepo = {
    create: (userId: number, input: CreateDoctorInput) => {
        return dbOperation(
            () => prisma.doctors.create({
                data: { user_id: userId, ...input },
                select: SELECT,
            }),
            { operation: 'create', entity: ENTITY },
        );
    },

    findByUuid: (uuid: string) => {
        return dbOperation(
            () => prisma.doctors.findUnique({ where: { uuid }, select: SELECT }),
            { operation: 'findByUuid', entity: ENTITY },
        );
    },

    update: (uuid: string, input: UpdateDoctorInput) => {
        return dbOperation(
            () => prisma.doctors.update({ where: { uuid }, data: input, select: SELECT }),
            { operation: 'update', entity: ENTITY },
        );
    },

    setVerified: (uuid: string, verified: boolean) => {
        return dbOperation(
            () => prisma.doctors.update({
                where: { uuid },
                data: { verified, verified_at: verified ? new Date() : null },
                select: SELECT,
            }),
            { operation: 'setVerified', entity: ENTITY },
        );
    },

    search: (filters: DoctorSearchQuery) => {
        return dbOperation(
            async () => {
                const { q, specialization, language, min_fee, max_fee, min_rating } = filters;
                const { available_on, verified, sort, page, limit } = filters;

                const where: Prisma.doctorsWhereInput = {
                    ...(verified !== undefined && { verified }),
                    ...(specialization && {
                        specialization: { equals: specialization, mode: 'insensitive' },
                    }),
                    ...(language && { languages: { has: language } }),
                    ...((min_fee !== undefined || max_fee !== undefined) && {
                        consultation_fee: { gte: min_fee, lte: max_fee },
                    }),
                    ...(min_rating !== undefined && { rating: { gte: min_rating } }),
                    ...(q && { user: { name: { contains: q, mode: 'insensitive' } } }),
                    ...(available_on && {
                        slots: {
                            some: {
                                status: SlotStatus.AVAILABLE,
                                start_time: dayRange(available_on),
                            },
                        },
                    }),
                };

                const [data, total] = await Promise.all([
                    prisma.doctors.findMany({
                        where,
                        select: SELECT,
                        orderBy: ORDER[sort],
                        skip: (page - 1) * limit,
                        take: limit,
                    }),
                    prisma.doctors.count({ where }),
                ]);

                return { data, total, page, limit };
            },
            { operation: 'search', entity: ENTITY },
        );
    },
};