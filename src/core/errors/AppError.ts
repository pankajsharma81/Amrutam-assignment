/**
 * Custom operational error class.
 *
 * Usage:
 *   throw new AppError('Resource not found', HTTP_STATUS.NOT_FOUND);
 *   throw new AppError('Duplicate entry', HTTP_STATUS.CONFLICT, { field: 'email' });
 */
export class AppError extends Error {
    public statusCode: number;
    public isOperational: boolean;
    public details?: unknown;

    constructor(
        message: string,
        statusCode: number,
        details?: unknown,
        isOperational = true,
    ) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;

        // Maintains proper stack trace for where the error was thrown
        Error.captureStackTrace(this, this.constructor);
    }
}
