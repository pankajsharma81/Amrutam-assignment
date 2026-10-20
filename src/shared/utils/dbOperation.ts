import { Prisma } from '@prisma/client';
import { AppError } from '../../core/errors/AppError';
import { HTTP_STATUS } from '../constants';
import { logError } from '../../utils/logger';

interface DbOperationOptions {
    operation: string;
    entity: string;
}

/**
 * Wraps a Prisma call with structured error handling and logging.
 * Maps Prisma error codes to meaningful AppError instances.
 *
 * Usage:
 *   return dbOperation(
 *     () => prisma.user.findMany(),
 *     { operation: 'findMany', entity: 'User' }
 *   );
 */
export async function dbOperation<T>(
    fn: () => Promise<T>,
    options: DbOperationOptions,
): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        const { operation, entity } = options;
        const feature = `DB_${entity.toUpperCase()}_${operation.toUpperCase()}`;

        // Re-throw operational AppErrors unchanged
        if (error instanceof AppError) {
            throw error;
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            logError(feature, `Prisma error [${error.code}]`, error, { entity, operation });

            switch (error.code) {
                case 'P2002':
                    throw new AppError(
                        `${entity} already exists`,
                        HTTP_STATUS.CONFLICT,
                        { fields: error.meta?.target },
                    );
                case 'P2025':
                    throw new AppError(`${entity} not found`, HTTP_STATUS.NOT_FOUND);
                case 'P2003':
                    throw new AppError(
                        `Related record not found for ${entity}`,
                        HTTP_STATUS.BAD_REQUEST,
                        { field: error.meta?.field_name },
                    );
                default:
                    throw new AppError('Database operation failed', HTTP_STATUS.INTERNAL_SERVER_ERROR);
            }
        }

        if (error instanceof Prisma.PrismaClientValidationError) {
            logError(feature, 'Prisma validation error', error, { entity, operation });
            throw new AppError('Invalid data provided', HTTP_STATUS.BAD_REQUEST);
        }

        if (error instanceof Prisma.PrismaClientInitializationError) {
            logError(feature, 'Database connection failed', error, { entity, operation });
            throw new AppError('Service temporarily unavailable', HTTP_STATUS.SERVICE_UNAVAILABLE, undefined, false);
        }

        logError(feature, 'Unexpected database error', error, { entity, operation });
        throw new AppError('An unexpected error occurred', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
}
