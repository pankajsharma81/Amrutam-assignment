import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../../config/env';

const HEX_KEY = /^[0-9a-fA-F]{64}$/;

const buildKeyring = (): Map<string, Buffer> => {
    const ring = new Map<string, Buffer>();
    ring.set(env.ENCRYPTION_KEY_ID, Buffer.from(env.ENCRYPTION_KEY, 'hex'));
    for (const entry of env.ENCRYPTION_PREVIOUS_KEYS.split(',').filter(Boolean)) {
        const [id, hex] = entry.split(':');
        if (id && hex && HEX_KEY.test(hex)) ring.set(id, Buffer.from(hex, 'hex'));
    }
    return ring;
};

const keyring = buildKeyring();
const currentKey = keyring.get(env.ENCRYPTION_KEY_ID) as Buffer;

export const encrypt = (plaintext: string): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', currentKey, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        env.ENCRYPTION_KEY_ID,
        iv.toString('base64'),
        tag.toString('base64'),
        data.toString('base64'),
    ].join(':');
};

export const decrypt = (payload: string): string => {
    const [keyId, iv, tag, data] = payload.split(':');
    const key = keyId ? keyring.get(keyId) : undefined;
    if (!key || !iv || !tag || !data) throw new Error('Invalid encrypted payload');

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
};

export const needsReEncryption = (payload: string): boolean =>
    payload.split(':')[0] !== env.ENCRYPTION_KEY_ID;