import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import {
    bookSchema,
    cancelSchema,
    idParamSchema,
    listSchema,
    notesSchema,
    rescheduleSchema,
} from './consultation.schema';
import { ConsultationService } from './consultation.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { audit } from '../../shared/utils/audit';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const bookHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = bookSchema.parse({ body: req.body });
    const actor = requireUser(req);
    const consultation = await ConsultationService.book(actor, body.slot_uuid);
    await audit(req, {
        actor,
        action: 'CONSULTATION_BOOKED',
        resource: 'consultation',
        resourceId: consultation.uuid,
        metadata: { slot_uuid: body.slot_uuid },
    });
    sendSuccess(res, consultation, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const listHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = listSchema.parse({ query: req.query });
    sendSuccess(res, await ConsultationService.list(requireUser(req), query));
});

export const getHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    sendSuccess(res, await ConsultationService.get(requireUser(req), params.uuid));
});

export const cancelHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = cancelSchema.parse({ params: req.params, body: req.body ?? {} });
    const actor = requireUser(req);
    const result = await ConsultationService.cancel(actor, params.uuid, body.reason);
    await audit(req, {
        actor,
        action: 'CONSULTATION_CANCELLED',
        resource: 'consultation',
        resourceId: params.uuid,
        metadata: { has_reason: Boolean(body.reason) },
    });
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const rescheduleHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = rescheduleSchema.parse({ params: req.params, body: req.body });
    const actor = requireUser(req);
    const result = await ConsultationService.reschedule(actor, params.uuid, body.new_slot_uuid);
    await audit(req, {
        actor,
        action: 'CONSULTATION_RESCHEDULED',
        resource: 'consultation',
        resourceId: params.uuid,
        metadata: { new_slot_uuid: body.new_slot_uuid },
    });
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const startHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    const actor = requireUser(req);
    const result = await ConsultationService.start(actor, params.uuid);
    await audit(req, {
        actor,
        action: 'CONSULTATION_STARTED',
        resource: 'consultation',
        resourceId: params.uuid,
    });
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const completeHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    const actor = requireUser(req);
    const result = await ConsultationService.complete(actor, params.uuid);
    await audit(req, {
        actor,
        action: 'CONSULTATION_COMPLETED',
        resource: 'consultation',
        resourceId: params.uuid,
    });
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const notesHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = notesSchema.parse({ params: req.params, body: req.body });
    const actor = requireUser(req);
    const result = await ConsultationService.saveNotes(actor, params.uuid, body.notes);
    await audit(req, {
        actor,
        action: 'CONSULTATION_NOTES_SAVED',
        resource: 'consultation',
        resourceId: params.uuid,
    });
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});