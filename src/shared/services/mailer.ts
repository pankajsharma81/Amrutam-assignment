import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import { logError, logInfo } from '../../utils/logger';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter | null => {
    if (!env.EMAIL || !env.EMAIL_PASSWORD) return null;

    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail', // change host/port here for another SMTP provider
            auth: { user: env.EMAIL, pass: env.EMAIL_PASSWORD },
        });
    }
    return transporter;
};

export const sendMail = async (to: string, subject: string, text: string): Promise<void> => {
    const t = getTransporter();
    if (!t) {
        logInfo('MAILER', 'SMTP not configured, email skipped', { to, subject });
        return;
    }

    try {
        await t.sendMail({ from: env.EMAIL_SENDER, to, subject, text });
    } catch (error) {
        logError('MAILER', 'Failed to send email', error, { to, subject });
    }
};

export const sendVerificationEmail = (to: string, token: string): Promise<void> =>
    sendMail(
        to,
        'Verify your Amrutam account',
        `Welcome to Amrutam.\n\nYour email verification token is:\n\n${token}\n\n` +
            'It expires in 24 hours. If you did not create this account, ignore this email.',
    );