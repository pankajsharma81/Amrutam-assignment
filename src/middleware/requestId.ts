import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const requestId = (req: Request, res: Response, next: NextFunction) => {
    const incoming = req.get('x-request-id');
    const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('X-Request-Id', id);
    next();
};