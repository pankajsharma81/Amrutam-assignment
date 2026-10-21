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
import { RawBodyRequest } from './types';
import { requestId } from './middleware/requestId';
import { metricsMiddleware } from './middleware/metrics';
import { registry } from './shared/metrics';


const app = express();
const PORT = env.PORT;
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet());
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(null, false);
    },
    credentials: true,
}));
app.use(requestId);
app.use(metricsMiddleware);

app.get('/metrics', async (req, res) => {
    if (env.METRICS_TOKEN && req.get('authorization') !== `Bearer ${env.METRICS_TOKEN}`) {
        res.status(401).end();
        return;
    }
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/v1/payments/webhook',
    message: {
        success: false,
        message: 'Too many requests, please try again later.',
    },
});

app.use(limiter);
app.use(morgan('dev'));
app.use(requestLogger);
app.use(express.json({
    limit: '3mb',
    verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
    },
}));
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
