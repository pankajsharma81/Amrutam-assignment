import { createHmac, timingSafeEqual } from 'crypto';

export const verifyHmacSignature = (raw: Buffer, signature: string, secret: string): boolean => {
    const expected = createHmac('sha256', secret).update(raw).digest();
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
};