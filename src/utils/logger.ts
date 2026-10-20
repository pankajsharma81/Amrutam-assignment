import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const logger = winston.createLogger({
    level: env.LOG_LEVEL ?? 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        env.NODE_ENV === 'development'
            ? winston.format.prettyPrint()
            : winston.format.json(),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

/**
 * Structured error logger.
 * Call from catch blocks for centralised, searchable error records.
 */
export const logError = (
    feature: string,
    message: string,
    error: unknown,
    meta?: Record<string, unknown>,
) => {
    logger.error(message, {
        feature,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...meta,
    });
};

/**
 * Structured info logger.
 */
export const logInfo = (feature: string, message: string, meta?: Record<string, unknown>) => {
    logger.info(message, { feature, ...meta });
};

/**
 * Express request logging middleware (attach after morgan).
 * Logs structured request details at the info level.
 */
export const requestLogger = (req: Request, _res: Response, next: NextFunction) => {
    logger.http(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
};

export default logger;
