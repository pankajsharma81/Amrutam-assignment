import { Request, Response } from 'express';
import { AuthenticatedRequest, RawBodyRequest } from '../../types';
import { idParamSchema, intentSchema, listSchema, refundSchema, webhookSchema } from './payment.schema';
import { PaymentService } from './payment.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { verifyHmacSignature } from '../../shared/utils/signature';
import { audit } from '../../shared/utils/audit';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const intentHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = intentSchema.parse({ body: req.body });
    const actor = requireUser(req);
    const payment = await PaymentService.createIntent(actor, body.consultation_uuid);

    await audit(req, {
        actor,
        action: 'PAYMENT_INTENT_CREATED',
        resource: 'payment',
        resourceId: payment.uuid,
        metadata: { consultation_uuid: body.consultation_uuid },
    });
    sendSuccess(res, payment, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const webhookHandler = asyncWrapper(async (req: Request, res: Response) => {
    const raw = (req as RawBodyRequest).rawBody;
    const signature = req.get('X-Signature');
    if (!raw || !signature || !verifyHmacSignature(raw, signature, env.PAYMENT_WEBHOOK_SECRET)) {
        await audit(req, { action: 'PAYMENT_WEBHOOK_REJECTED', resource: 'payment' });
        throw new AppError('Invalid signature', HTTP_STATUS.UNAUTHORIZED);
    }

    const { body } = webhookSchema.parse({ body: req.body });
    const result = await PaymentService.handleWebhook(body.provider_ref, body.event);

    await audit(req, {
        action: 'PAYMENT_WEBHOOK_PROCESSED',
        resource: 'payment',
        resourceId: body.provider_ref,
        metadata: { event: body.event, result },
    });
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
    const actor = requireUser(req);
    const payment = await PaymentService.refund(params.uuid, body.amount);

    await audit(req, {
        actor,
        action: 'PAYMENT_REFUNDED',
        resource: 'payment',
        resourceId: params.uuid,
        metadata: { requested_amount: body.amount ?? 'full', refunded_total: payment.refunded_amount },
    });
    sendSuccess(res, payment, RESPONSE_MESSAGES.UPDATED);
});