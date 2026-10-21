import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = 6;
const DAYS_AHEAD = 3;

const ADMIN_PASSWORD = 'Admin@123';
const PATIENT_PASSWORD = 'Patient@123';
const DOCTOR_PASSWORD = 'Doctor@123';

const patients = [
    { email: 'patient1@example.com', name: 'Pankaj Sharma' },
    { email: 'patient2@example.com', name: 'Neha Gupta' },
];

const doctors = [
    {
        email: 'dr.asha@amrutam.com',
        name: 'Dr. Asha Verma',
        specialization: 'Cardiology',
        license_number: 'MH-CARD-1001',
        experience_years: 12,
        consultation_fee: 800,
        languages: ['english', 'hindi'],
        rating: 4.8,
        bio: 'Heart specialist with 12 years of experience.',
        verified: true,
    },
    {
        email: 'dr.rohan@amrutam.com',
        name: 'Dr. Rohan Mehta',
        specialization: 'Dermatology',
        license_number: 'GJ-DERM-2002',
        experience_years: 7,
        consultation_fee: 500,
        languages: ['english', 'gujarati', 'hindi'],
        rating: 4.5,
        bio: 'Skin and hair care specialist.',
        verified: true,
    },
    {
        email: 'dr.meera@amrutam.com',
        name: 'Dr. Meera Nair',
        specialization: 'General Physician',
        license_number: 'KL-GEN-3003',
        experience_years: 5,
        consultation_fee: 300,
        languages: ['english', 'malayalam', 'hindi'],
        rating: 4.2,
        bio: 'Primary care for adults and families.',
        verified: true,
    },
    {
        email: 'dr.kiran@amrutam.com',
        name: 'Dr. Kiran Rao',
        specialization: 'Pediatrics',
        license_number: 'KA-PED-4004',
        experience_years: 15,
        consultation_fee: 600,
        languages: ['english', 'kannada', 'hindi'],
        rating: 4.9,
        bio: 'Child health and vaccination expert.',
        verified: true,
    },
    {
        email: 'dr.pending@amrutam.com',
        name: 'Dr. Pending Approval',
        specialization: 'Orthopedics',
        license_number: 'DL-ORTH-5005',
        experience_years: 3,
        consultation_fee: 700,
        languages: ['english', 'hindi'],
        rating: 0,
        bio: 'Awaiting license verification.',
        verified: false,
    },
];

const buildSlots = (doctorId: number) => {
    const slots: { doctor_id: number; start_time: Date; end_time: Date }[] = [];
    for (let day = 1; day <= DAYS_AHEAD; day++) {
        for (let i = 0; i < SLOTS_PER_DAY; i++) {
            const start = new Date();
            start.setUTCDate(start.getUTCDate() + day);
            start.setUTCHours(4, 30 + i * SLOT_MINUTES, 0, 0);
            const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);
            slots.push({ doctor_id: doctorId, start_time: start, end_time: end });
        }
    }
    return slots;
};

const upsertUser = (email: string, name: string, role: UserRole, password: string) =>
    prisma.users.upsert({
        where: { email },
        update: {},
        create: { email, name, role, password, email_verified: true },
    });

async function main() {
    console.log('Seeding database...');

    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
    const patientHash = await bcrypt.hash(PATIENT_PASSWORD, SALT_ROUNDS);
    const doctorHash = await bcrypt.hash(DOCTOR_PASSWORD, SALT_ROUNDS);

    await upsertUser('admin@demo.com', 'System Admin', UserRole.ADMIN, adminHash);

    for (const p of patients) {
        await upsertUser(p.email, p.name, UserRole.PATIENT, patientHash);
    }

    for (const d of doctors) {
        const user = await upsertUser(d.email, d.name, UserRole.DOCTOR, doctorHash);

        const doctor = await prisma.doctors.upsert({
            where: { user_id: user.id },
            update: {},
            create: {
                user_id: user.id,
                specialization: d.specialization,
                license_number: d.license_number,
                experience_years: d.experience_years,
                consultation_fee: d.consultation_fee,
                languages: d.languages,
                rating: d.rating,
                bio: d.bio,
                verified: d.verified,
                verified_at: d.verified ? new Date() : null,
            },
        });

        if (d.verified) {
            await prisma.availability_slots.createMany({
                data: buildSlots(doctor.id),
                skipDuplicates: true,
            });
        }
    }

    console.log('Seed complete');
    console.log(`Admin   : admin@demo.com / ${ADMIN_PASSWORD}`);
    console.log(`Patients: patient1@example.com, patient2@example.com / ${PATIENT_PASSWORD}`);
    console.log(`Doctors : dr.asha@amrutam.com, dr.rohan@amrutam.com, dr.meera@amrutam.com, dr.kiran@amrutam.com, dr.pending@amrutam.com / ${DOCTOR_PASSWORD}`);
}

main()
    .catch((e) => {
        console.error('Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });