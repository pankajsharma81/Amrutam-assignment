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

        Error.captureStackTrace(this, this.constructor);
    }
}
