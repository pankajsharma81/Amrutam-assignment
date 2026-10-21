import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import { createPrescriptionSchema, idParamSchema, revokeSchema } from './prescription.schema';
import { PrescriptionService } from './prescription.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const createPrescriptionHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = createPrescriptionSchema.parse({ params: req.params, body: req.body });
    const prescription = await PrescriptionService.create(requireUser(req), params.uuid, body);
    sendSuccess(res, prescription, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const getByConsultationHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    sendSuccess(res, await PrescriptionService.getByConsultation(requireUser(req), params.uuid));
});

export const getPrescriptionHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    sendSuccess(res, await PrescriptionService.getByUuid(requireUser(req), params.uuid));
});

export const revokePrescriptionHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = revokeSchema.parse({ params: req.params, body: req.body });
    const result = await PrescriptionService.revoke(requireUser(req), params.uuid, body.reason);
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});