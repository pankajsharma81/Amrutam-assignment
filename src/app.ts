import express from 'express';
import 'reflect-metadata';
import 'dotenv/config';
import { env } from './config/env';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes/routes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { requestLogger } from './utils/logger';
import { PrismaProvider } from './config/prismaClient';
import { setupSwagger } from './config/swagger';

const app = express();
const PORT = env.PORT;

app.use(helmet());
app.use(cors());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
    },
});

app.use(limiter);
app.use(morgan('dev'));
app.use(requestLogger);
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

if (env.NODE_ENV !== 'production') {
    setupSwagger(app);
}

app.use('/v1', routes);
app.use(errorMiddleware);

const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📄 Swagger docs: http://localhost:${PORT}/api-docs`);
});

let shuttingDown = false;
const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully...`);

    server.close(async () => {
        console.log('🌐 HTTP server closed');

        try {
            await PrismaProvider.disconnect();
            console.log('🗄️  DB disconnected');
            process.exit(0);
        } catch (err) {
            console.error('❌ Shutdown error:', err);
            process.exit(1);
        }
    });
};

if (!(global as any).__shutdown_registered__) {
    (global as any).__shutdown_registered__ = true;
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
