import { createHash, randomBytes } from 'crypto';

export const generateToken = (bytes = 32): string => randomBytes(bytes).toString('hex');

export const sha256 = (value: string): string =>
    createHash('sha256').update(value).digest('hex');