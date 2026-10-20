import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../core/errors/AppError';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../shared/constants';
import { AUTH_ERROR_CODES } from '../shared/constants/authErrorCodes';
import { logError } from '../utils/logger';
import { env } from '../config/env';

export const errorMiddleware = (
    err: Error,
    req: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: NextFunction,
) => {
    logError('GLOBAL_ERROR_HANDLER', err.message, err, {
        path: req.path,
        method: req.method,
    });

    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message: string = RESPONSE_MESSAGES.SERVER_ERROR;
    let errorDetails: unknown = null;

    // ── AppError (Trusted operational errors) ──────────────────
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        errorDetails = err.details;

        if (statusCode === HTTP_STATUS.UNAUTHORIZED) {
            errorDetails = err.details ?? AUTH_ERROR_CODES.INVALID_TOKEN;
        }
    }
    // ── Zod Validation Errors ───────────────────────────────────
    else if (err instanceof ZodError) {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = err.errors
            .map((e) => `${e.path.length ? e.path.join('.') + ': ' : ''}${e.message}`)
            .join(', ');
        errorDetails = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
    }
    // ── Prisma Errors ───────────────────────────────────────────
    else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            statusCode = HTTP_STATUS.CONFLICT;
            message = 'Duplicate entry found';
        } else if (err.code === 'P2025') {
            statusCode = HTTP_STATUS.NOT_FOUND;
            message = RESPONSE_MESSAGES.NOT_FOUND;
        }
    }
    // ── JWT Errors ──────────────────────────────────────────────
    else if (err.name === 'TokenExpiredError') {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = 'Token expired';
        errorDetails = AUTH_ERROR_CODES.TOKEN_EXPIRED;
    } else if (err.name === 'JsonWebTokenError') {
        statusCode = HTTP_STATUS.UNAUTHORIZED;
        message = 'Invalid token';
        errorDetails = AUTH_ERROR_CODES.INVALID_TOKEN;
    }

    res.status(statusCode).json({
        success: false,
        message,
        error: errorDetails,
        stack: env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};
