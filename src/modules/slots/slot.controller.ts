import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import {
    createSlotsSchema,
    listSlotsSchema,
    slotParamsSchema,
    updateSlotSchema,
} from './slot.schema';
import { SlotService } from './slot.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const createSlotsHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid }, body } = createSlotsSchema.parse({ params: req.params, body: req.body });
    const result = await SlotService.create(requireUser(req), uuid, body);
    sendSuccess(res, result, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const listSlotsHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid }, query } = listSlotsSchema.parse({ params: req.params, query: req.query });
    const result = await SlotService.list(requireUser(req), uuid, query);
    sendSuccess(res, result);
});

export const updateSlotHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid }, body: { status } } = updateSlotSchema.parse({
        params: req.params,
        body: req.body,
    });
    const result = await SlotService.updateStatus(requireUser(req), uuid, status);
    sendSuccess(res, result, RESPONSE_MESSAGES.UPDATED);
});

export const deleteSlotHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid } } = slotParamsSchema.parse({ params: req.params });
    await SlotService.remove(requireUser(req), uuid);
    sendSuccess(res, null, RESPONSE_MESSAGES.DELETED);
});