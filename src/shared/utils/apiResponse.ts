import { Response } from 'express';
import { HTTP_STATUS, RESPONSE_MESSAGES } from '../constants';

interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data?: T;
    error?: unknown;
}

export const sendSuccess = <T>(
    res: Response,
    data: T,
    message: string = RESPONSE_MESSAGES.SUCCESS,
    statusCode: number = HTTP_STATUS.OK,
) => {
    const response: ApiResponse<T> = {
        success: true,
        message,
        data,
    };
    return res.status(statusCode).json(response);
};

export const sendError = (
    res: Response,
    message: string = RESPONSE_MESSAGES.SERVER_ERROR,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    error?: unknown,
) => {
    const response: ApiResponse<null> = {
        success: false,
        message,
        error,
    };
    return res.status(statusCode).json(response);
};
