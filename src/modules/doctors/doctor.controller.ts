import { Response } from 'express';
import { AuthenticatedRequest } from '../../types';
import {
    createDoctorSchema,
    getDoctorSchema,
    searchDoctorsSchema,
    updateDoctorSchema,
    verifyDoctorSchema,
} from './doctor.schema';
import { DoctorService } from './doctor.service';
import { asyncWrapper } from '../../shared/utils/asyncWrapper';
import { requireUser } from '../../shared/utils/requireUser';
import { sendSuccess } from '../../shared/utils/apiResponse';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../../shared/constants';

export const createDoctorHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { body } = createDoctorSchema.parse({ body: req.body });
    const doctor = await DoctorService.create(requireUser(req), body);
    sendSuccess(res, doctor, RESPONSE_MESSAGES.CREATED, HTTP_STATUS.CREATED);
});

export const searchDoctorsHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { query } = searchDoctorsSchema.parse({ query: req.query });
    const result = await DoctorService.search(requireUser(req), query);
    sendSuccess(res, result);
});

export const getDoctorHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid } } = getDoctorSchema.parse({ params: req.params });
    const doctor = await DoctorService.getByUuid(requireUser(req), uuid);
    sendSuccess(res, doctor);
});

export const updateDoctorHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid }, body } = updateDoctorSchema.parse({
        params: req.params,
        body: req.body,
    });
    const doctor = await DoctorService.update(requireUser(req), uuid, body);
    sendSuccess(res, doctor, RESPONSE_MESSAGES.UPDATED);
});

export const verifyDoctorHandler = asyncWrapper(async (req: AuthenticatedRequest, res: Response) => {
    const { params: { uuid }, body: { verified } } = verifyDoctorSchema.parse({
        params: req.params,
        body: req.body,
    });
    const doctor = await DoctorService.verify(uuid, verified);
    sendSuccess(res, doctor, RESPONSE_MESSAGES.UPDATED);
});