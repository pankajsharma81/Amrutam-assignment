import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/prismaClient';

jest.setTimeout(30000);

const login = async (email: string, password: string): Promise<string> => {
    const res = await request(app).post('/v1/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    return res.body.data.access_token as string;
};

const book = (token: string, slotUuid: string, key: string) =>
    request(app)
        .post('/v1/consultations')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({ slot_uuid: slotUuid });

describe('Booking', () => {
    let tokenA: string;
    let tokenB: string;
    let doctorId: number;
    const createdSlotIds: number[] = [];

    const newSlot = async () => {
        const start = new Date(Date.now() + 400 * 86400000 + Math.floor(Math.random() * 1e6) * 60000);
        const slot = await prisma.availability_slots.create({
            data: {
                doctor_id: doctorId,
                start_time: start,
                end_time: new Date(start.getTime() + 30 * 60000),
            },
        });
        createdSlotIds.push(slot.id);
        return slot;
    };

    beforeAll(async () => {
        tokenA = await login('patient1@example.com', 'Patient@123');
        tokenB = await login('patient2@example.com', 'Patient@123');
        const doctor = await prisma.doctors.findFirstOrThrow({ where: { verified: true } });
        doctorId = doctor.id;
    });

    afterAll(async () => {
        await prisma.consultations.deleteMany({ where: { slot_id: { in: createdSlotIds } } });
        await prisma.availability_slots.deleteMany({ where: { id: { in: createdSlotIds } } });
        await prisma.idempotency_keys.deleteMany({ where: { key: { startsWith: 'test-' } } });
        await prisma.$disconnect();
    });

    it('lets only one of two concurrent bookings win the same slot', async () => {
        const slot = await newSlot();
        const stamp = Date.now();

        const [a, b] = await Promise.all([
            book(tokenA, slot.uuid, `test-race-a-${stamp}`),
            book(tokenB, slot.uuid, `test-race-b-${stamp}`),
        ]);

        const statuses = [a.status, b.status].sort();
        expect(statuses).toEqual([201, 409]);

        const count = await prisma.consultations.count({ where: { slot_id: slot.id } });
        expect(count).toBe(1);

        const stored = await prisma.availability_slots.findUniqueOrThrow({ where: { id: slot.id } });
        expect(stored.status).toBe('BOOKED');
    });

    it('replays the same response for a repeated Idempotency-Key', async () => {
        const slot = await newSlot();
        const key = `test-idem-${Date.now()}`;

        const first = await book(tokenA, slot.uuid, key);
        const second = await book(tokenA, slot.uuid, key);

        expect(first.status).toBe(201);
        expect(second.status).toBe(201);
        expect(second.headers['idempotent-replay']).toBe('true');
        expect(second.body.data.uuid).toBe(first.body.data.uuid);

        const count = await prisma.consultations.count({ where: { slot_id: slot.id } });
        expect(count).toBe(1);
    });

    it('rejects a missing Idempotency-Key', async () => {
        const slot = await newSlot();
        const res = await request(app)
            .post('/v1/consultations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ slot_uuid: slot.uuid });
        expect(res.status).toBe(400);
    });

    it('rejects the same key reused with a different request', async () => {
        const slotOne = await newSlot();
        const slotTwo = await newSlot();
        const key = `test-reuse-${Date.now()}`;

        const first = await book(tokenA, slotOne.uuid, key);
        const second = await book(tokenA, slotTwo.uuid, key);

        expect(first.status).toBe(201);
        expect(second.status).toBe(422);
    });
});