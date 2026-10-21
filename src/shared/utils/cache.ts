import { getRedisClient } from '../../config/redis';
import { logError } from '../../utils/logger';

export const cacheGet = async <T>(key: string): Promise<T | null> => {
    try {
        const raw = await getRedisClient().get(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
        logError('CACHE', 'get failed', error, { key });
        return null;
    }
};

export const cacheSet = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    try {
        await getRedisClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
        logError('CACHE', 'set failed', error, { key });
    }
};

export const cacheGetVersion = async (key: string): Promise<string> => {
    try {
        return (await getRedisClient().get(key)) ?? '0';
    } catch (error) {
        logError('CACHE', 'version get failed', error, { key });
        return '0';
    }
};

export const cacheBumpVersion = async (key: string): Promise<void> => {
    try {
        await getRedisClient().incr(key);
    } catch (error) {
        logError('CACHE', 'version bump failed', error, { key });
    }
};