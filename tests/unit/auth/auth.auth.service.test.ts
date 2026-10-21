import { hashPassword, verifyPassword, generateTokenPair } from '../../../src/modules/auth/auth.tokens';

describe('Auth Service — hashPassword / verifyPassword', () => {
    it('should hash and verify a password correctly', async () => {
        const plain = 'MySecretPass1';
        const hash = await hashPassword(plain);
        expect(hash).not.toBe(plain);
        expect(await verifyPassword(plain, hash)).toBe(true);
        expect(await verifyPassword('wrong', hash)).toBe(false);
    });
});

describe('Auth Service — generateTokenPair', () => {
    it('should generate an access and refresh token', () => {
        const pair = generateTokenPair({ id: 1, uuid: 'test-uuid', user_type: 'ADMIN' });
        expect(pair.access_token).toBeDefined();
        expect(pair.refresh_token).toBeDefined();
        expect(pair.token_type).toBe('Bearer');
        expect(pair.sid).toBeDefined();
    });
});
