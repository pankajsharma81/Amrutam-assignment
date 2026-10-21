import { Request, Response } from 'express';
import { AuthenticatedRequest, RawBodyRequest } from '../../types';
import { idParamSchema, intentSchema, listSchema, refundSchema, webhookSchema } from './payment.schema';
import { PaymentService } from './payment.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { verifyHmacSignature } from '../../shared/utils/signature';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const intentHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = intentSchema.parse({ body: req.body });
    const payment = await PaymentService.createIntent(requireUser(req), body.consultation_uuid);
    sendSuccess(res, payment, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const webhookHandler = asyncWrapper(async (req: Request, res: Response) => {
    const raw = (req as RawBodyRequest).rawBody;
    const signature = req.get('X-Signature');
    if (!raw || !signature || !verifyHmacSignature(raw, signature, env.PAYMENT_WEBHOOK_SECRET)) {
        throw new AppError('Invalid signature', HTTP_STATUS.UNAUTHORIZED);
    }

    const { body } = webhookSchema.parse({ body: req.body });
    const result = await PaymentService.handleWebhook(body.provider_ref, body.event);
    sendSuccess(res, { received: true, result });
});

export const getHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    sendSuccess(res, await PaymentService.get(requireUser(req), params.uuid));
});

export const listHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = listSchema.parse({ query: req.query });
    sendSuccess(res, await PaymentService.list(requireUser(req), query));
});

export const refundHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = refundSchema.parse({ params: req.params, body: req.body ?? {} });
    sendSuccess(res, await PaymentService.refund(params.uuid, body.amount), RESPONSE_MESSAGES.UPDATED);
});