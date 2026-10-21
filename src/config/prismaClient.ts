import { PrismaClient } from '@prisma/client';
import { env } from './env';

class PrismaProvider {
    private static instance: PrismaClient;

    static getClient(): PrismaClient {
        if (!PrismaProvider.instance) {
            const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

            if (globalForPrisma.__prisma) {
                PrismaProvider.instance = globalForPrisma.__prisma;
            } else {
                PrismaProvider.instance = new PrismaClient({
                    log: env.NODE_ENV === 'development'
                        ? ['query', 'warn', 'error']
                        : ['error'],
                });

                if (env.NODE_ENV !== 'production') {
                    globalForPrisma.__prisma = PrismaProvider.instance;
                }
            }
        }

        return PrismaProvider.instance;
    }

    static async connect(): Promise<void> {
        await PrismaProvider.getClient().$connect();
    }

    static async disconnect(): Promise<void> {
        await PrismaProvider.getClient().$disconnect();
    }
}

const prisma = PrismaProvider.getClient();

export { PrismaProvider };
export default prisma;
