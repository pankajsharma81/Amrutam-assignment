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
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const bookHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = bookSchema.parse({ body: req.body });
    const consultation = await ConsultationService.book(requireUser(req), body.slot_uuid);
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
    const result = await ConsultationService.cancel(requireUser(req), params.uuid, body.reason);
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const rescheduleHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = rescheduleSchema.parse({ params: req.params, body: req.body });
    const result = await ConsultationService.reschedule(
        requireUser(req),
        params.uuid,
        body.new_slot_uuid,
    );
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const startHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    sendSuccess(res, await ConsultationService.start(requireUser(req), params.uuid), RESPONSE_MESSAGES.UPDATED);
});

export const completeHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params } = idParamSchema.parse({ params: req.params });
    sendSuccess(res, await ConsultationService.complete(requireUser(req), params.uuid), RESPONSE_MESSAGES.UPDATED);
});

export const notesHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params, body } = notesSchema.parse({ params: req.params, body: req.body });
    sendSuccess(
        res,
        await ConsultationService.saveNotes(requireUser(req), params.uuid, body.notes),
        RESPONSE_MESSAGES.UPDATED,
    );
});