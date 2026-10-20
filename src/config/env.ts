import { z } from 'zod';


const envSchema = z.object({
    
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
        .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
        .optional(),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),

  
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'e.g. 15m, 1h').default('15m'),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
    SALT_ROUNDS: z.coerce.number().int().min(4).max(31).default(10),
    MFA_ISSUER: z.string().default('Amrutam'),


    ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars'),
    ENCRYPTION_KEY_ID: z.string().default('k1'),
   
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),
 
    EMAIL: z.string().email().optional().or(z.literal('')),
    EMAIL_PASSWORD: z.string().optional(),
    EMAIL_SENDER: z.string().email().default('noreply@amrutam.local'),

    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('\n❌  Environment variable validation failed:\n');

    const errors = parsed.error.flatten().fieldErrors;
    for (const [key, messages] of Object.entries(errors)) {
        console.error(`  • ${key}: ${(messages as string[]).join(', ')}`);
    }

    console.error('\nPlease check your .env file and fix the above errors.\n');
    process.exit(1);
}

export const env = Object.freeze(parsed.data);

export type Env = z.infer<typeof envSchema>;
