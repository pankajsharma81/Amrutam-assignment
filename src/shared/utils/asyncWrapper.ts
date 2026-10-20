import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler and forwards any rejected promise to Express
 * `next()` so that the global error middleware can handle it.
 *
 * Usage:
 *   router.get('/path', asyncWrapper(async (req, res) => { ... }));
 */
export const asyncWrapper = (fn: RequestHandler) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
