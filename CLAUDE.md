# CLAUDE.md

This file provides guidance to AI coding assistants (Claude, Gemini, etc.) when working with code in this repository.

## Commands

```bash
# Development
npm run dev            # Start dev server with ts-node/nodemon watch

# Build
npm run build          # Compile TypeScript → dist/
npm start              # Build + run production

# Database (Prisma)
npm run prisma:generate   # Regenerate Prisma client after schema changes
npm run prisma:migrate    # Run pending migrations
npm run prisma:studio     # Launch Prisma Studio UI
npm run prisma:seed       # Seed the database

# Tests
npm test               # Run Jest tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report

# Code Quality
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run format         # Prettier format
```

After any `prisma/schema.prisma` change, run a migration and then `npm run prisma:generate` before running the server.

## Architecture

### Entry point and middleware chain
`src/app.ts` → helmet → cors → rate-limiter → morgan → Zod-validated env (`src/config/env.ts`) → Swagger (non-prod) → `/v1` router → global error handler.

All environment variables are validated at startup via `src/config/env.ts` (Zod schema). If any required var is missing the process exits immediately with a descriptive error.

### Module structure
All features live under `src/modules/` split into role namespaces:

- `management/` — staff/admin facing routes
- `customer/`   — customer/end-user facing routes
- `superadmin/` — platform-level administration

Each module folder follows this convention:
```
<feature>/
  index.ts               # re-exports routes
  <feature>.routes.ts    # Express Router, applies middleware
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.repo.ts      # all Prisma queries
  <feature>.schema.ts    # Zod request schemas
  <feature>.interface.ts
  <feature>.constants.ts
```

### Database access
Single Prisma client singleton via `src/config/prismaClient.ts` (`PrismaProvider.getClient()`). Import it as:
```ts
import prisma from '../../../config/prismaClient';
```
Repos do all direct Prisma calls. Services call repos, controllers call services.

### Auth
Two separate JWT middlewares in `src/middleware/authMiddleware.ts`:
- `adminAuthMiddleware` — for superadmin routes; populates `req.admin`
- `authMiddleware`      — for management/customer routes; populates `req.user`

Access tokens include `typ: 'access'`; refresh tokens are stored in DB (not Redis).

### Error handling
Throw `AppError` (from `src/core/errors/AppError.ts`) for operational errors:
```ts
throw new AppError('message', HTTP_STATUS.NOT_FOUND);
```
The global error middleware (`src/middleware/errorMiddleware.ts`) handles `AppError`, Zod `ZodError`, Prisma `PrismaClientKnownRequestError`, and JWT errors — all other errors become 500.

Use constants from `src/shared/constants` for HTTP status codes (`HTTP_STATUS`) and standard messages (`RESPONSE_MESSAGES`).

### Key patterns
- **asyncWrapper** — wraps async controllers to forward errors to `next()`
- **dbOperation** — wraps Prisma calls with structured error handling and logging
- **sendSuccess / sendError** — standardised JSON response helpers
- All Zod schemas live in `<feature>.schema.ts` and are applied in controllers
- All DB SELECT field lists live as constants in `<feature>.constants.ts`
