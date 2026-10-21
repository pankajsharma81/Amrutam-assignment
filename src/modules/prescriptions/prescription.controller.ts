import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { createPrescriptionSchema, idParamSchema, revokeSchema } from './prescription.schema';
import { PrescriptionService } from './prescription.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { audit } from '../../shared/utils/audit';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const createPrescriptionHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = createPrescriptionSchema.parse({ params: req.params, body: req.body });
    const actor = requireUser(req);
    const prescription = await PrescriptionService.create(actor, params.uuid, body);

    await audit(req, {
        actor,
        action: 'PRESCRIPTION_CREATED',
        resource: 'prescription',
        resourceId: prescription.uuid,
        metadata: { consultation_uuid: params.uuid },
    });

    res.locals.idempotencyBody = {
        success: true,
        message: RESPONSE_MESSAGES.CREATED,
        data: { uuid: prescription.uuid },
    };
    sendSuccess(res, prescription, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const getByConsultationHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    const actor = requireUser(req);
    const prescription = await PrescriptionService.getByConsultation(actor, params.uuid);

    await audit(req, {
        actor,
        action: 'PRESCRIPTION_VIEWED',
        resource: 'prescription',
        resourceId: prescription.uuid,
        metadata: { consultation_uuid: params.uuid },
    });
    sendSuccess(res, prescription);
});

export const getPrescriptionHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    const actor = requireUser(req);
    const prescription = await PrescriptionService.getByUuid(actor, params.uuid);

    await audit(req, {
        actor,
        action: 'PRESCRIPTION_VIEWED',
        resource: 'prescription',
        resourceId: params.uuid,
    });
    sendSuccess(res, prescription);
});

export const revokePrescriptionHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = revokeSchema.parse({ params: req.params, body: req.body });
    const actor = requireUser(req);
    const result = await PrescriptionService.revoke(actor, params.uuid, body.reason);

    await audit(req, {
        actor,
        action: 'PRESCRIPTION_REVOKED',
        resource: 'prescription',
        resourceId: params.uuid,
    });
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});