import { NextFunction, Request, Response } from 'express';
import { httpRequestDuration, httpRequestsTotal } from '../shared/metrics';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const end = httpRequestDuration.startTimer();
    res.on('finish', () => {
        const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
        const labels = { method: req.method, route, status: String(res.statusCode) };
        end(labels);
        httpRequestsTotal.inc(labels);
    });
    next();
};