import { NextFunction, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prismaClient';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../core/errors/AppError';
import { HTTP_STATUS } from '../shared/constants';
import { sha256 } from '../shared/utils/token';
import { logError } from '../utils/logger';

const TTL_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 60 * 1000;
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

export const idempotency = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    try {
        const user = req.user;
        if (!user) throw new AppError('Unauthorized access', HTTP_STATUS.UNAUTHORIZED);

        const key = req.get('Idempotency-Key');
        if (!key || !KEY_RE.test(key)) {
            throw new AppError(
                'Idempotency-Key header is required (8-128 chars: A-Z a-z 0-9 _ -)',
                HTTP_STATUS.BAD_REQUEST,
            );
        }

        const requestHash = sha256(
            `${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`,
        );

        const claim = () =>
            prisma.idempotency_keys.create({
                data: {
                    key,
                    user_id: user.id,
                    request_hash: requestHash,
                    expires_at: new Date(Date.now() + TTL_MS),
                },
            });
        const deleteRow = () =>
            prisma.idempotency_keys.deleteMany({ where: { user_id: user.id, key } });

        try {
            await claim();
        } catch (err) {
            const isDuplicate =
                err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
            if (!isDuplicate) throw err;

            const existing = await prisma.idempotency_keys.findUnique({
                where: { user_id_key: { user_id: user.id, key } },
            });
            if (!existing) {
                throw new AppError('Please retry the request', HTTP_STATUS.CONFLICT);
            }

            if (existing.expires_at <= new Date()) {
                await deleteRow();
                await claim();
            } else if (existing.request_hash !== requestHash) {
                throw new AppError(
                    'Idempotency-Key was already used with a different request',
                    HTTP_STATUS.UNPROCESSABLE_ENTITY,
                );
            } else if (existing.response_status !== null) {
                res.set('Idempotent-Replay', 'true');
                res.status(existing.response_status).json(existing.response_body);
                return;
            } else if (Date.now() - existing.created_at.getTime() < STALE_MS) {
                throw new AppError(
                    'A request with this Idempotency-Key is still in progress',
                    HTTP_STATUS.CONFLICT,
                );
            } else {
                await deleteRow();
                await claim();
            }
        }

        const originalJson = res.json.bind(res);
        res.json = (body: unknown) => {
            const where = { user_id_key: { user_id: user.id, key } };
            const ok = res.statusCode >= 200 && res.statusCode < 300;
            const save = ok
                ? prisma.idempotency_keys.update({
                      where,
                      data: {
                          response_status: res.statusCode,
                          response_body: body as Prisma.InputJsonValue,
                      },
                  })
                : prisma.idempotency_keys.deleteMany({ where: { user_id: user.id, key } });

            save
                .catch((e) => logError('IDEMPOTENCY', 'persist failed', e, { key }))
                .finally(() => originalJson(body));
            return res;
        };

        next();
    } catch (err) {
        next(err);
    }
};