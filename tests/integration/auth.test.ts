import request from 'supertest';
import app from '../../src/app';

describe('Auth — POST /v1/auth/login', () => {
    it('should return 400 for missing body', async () => {
        const res = await request(app).post('/v1/auth/login').send({});
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid email', async () => {
        const res = await request(app)
            .post('/v1/auth/login')
            .send({ email: 'not-an-email', password: 'password' });
        expect(res.status).toBe(400);
    });

    it('should return 401 for wrong credentials', async () => {
        const res = await request(app)
            .post('/v1/auth/login')
            .send({ email: 'wrong@test.com', password: 'wrongpassword' });
        expect(res.status).toBe(401);
    });
});
