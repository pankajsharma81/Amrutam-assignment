import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../../shared/constants';
import { DoctorRepo } from './doctor.repo';
import { CreateDoctorInput, DoctorSearchQuery, UpdateDoctorInput } from './doctor.schema';

interface Actor {
    id: number;
    uuid: string;
    user_type: string;
}

const notFound = () => new AppError('Doctor not found', HTTP_STATUS.NOT_FOUND);
const isAdmin = (actor: Actor) => actor.user_type === 'ADMIN';

export const DoctorService = {
    create: (actor: Actor, input: CreateDoctorInput) => DoctorRepo.create(actor.id, input),

    search: (actor: Actor, query: DoctorSearchQuery) =>
        DoctorRepo.search({
            ...query,
            verified: isAdmin(actor) ? query.verified : true,
        }),

    getByUuid: async (actor: Actor, uuid: string) => {
        const doctor = await DoctorRepo.findByUuid(uuid);
        if (!doctor) throw notFound();

        const isOwner = doctor.user.uuid === actor.uuid;
        if (!doctor.verified && !isOwner && !isAdmin(actor)) throw notFound();
        return doctor;
    },

    update: async (actor: Actor, uuid: string, input: UpdateDoctorInput) => {
        const doctor = await DoctorRepo.findByUuid(uuid);
        if (!doctor) throw notFound();

        if (doctor.user.uuid !== actor.uuid && !isAdmin(actor)) {
            throw new AppError('You can only edit your own profile', HTTP_STATUS.FORBIDDEN);
        }
        return DoctorRepo.update(uuid, input);
    },

    verify: async (uuid: string, verified: boolean) => {
        const doctor = await DoctorRepo.findByUuid(uuid);
        if (!doctor) throw notFound();
        return DoctorRepo.setVerified(uuid, verified);
    },
};