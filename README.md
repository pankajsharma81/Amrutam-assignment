# Demo API — Project Structure

A clean, team-ready Express + TypeScript + Prisma project scaffold based on the school-api architecture.

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Runtime     | Node.js ≥ 20                      |
| Language    | TypeScript 5                      |
| Framework   | Express 5                         |
| Database    | PostgreSQL (via Prisma ORM)       |
| Cache       | Redis (ioredis)                   |
| Auth        | JWT (jsonwebtoken) + bcrypt       |
| Validation  | Zod                               |
| Logging     | Winston                           |
| Testing     | Jest + Supertest                  |
| API Docs    | Swagger / OpenAPI 3.0             |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# → Fill in DATABASE_URL, JWT_SECRET, etc.

# 3. Run DB migration + generate Prisma client
npx prisma migrate dev --name init
npm run prisma:generate

# 4. Seed the database (creates default admin)
npm run prisma:seed

# 5. Start dev server
npm run dev
```

API is available at `http://localhost:3000/v1`  
Swagger docs at `http://localhost:3000/api-docs`

---

## Project Structure

```
demo-structure/
├── prisma/
│   ├── schema.prisma         # DB schema
│   └── seed.ts               # Dev seed script
├── src/
│   ├── app.ts                # Entry point — middleware + server
│   ├── config/
│   │   ├── env.ts            # Zod-validated environment variables
│   │   ├── prismaClient.ts   # Prisma singleton
│   │   ├── redis.ts          # Redis singleton
│   │   └── swagger.ts        # Swagger setup
│   ├── core/
│   │   └── errors/
│   │       └── AppError.ts   # Operational error class
│   ├── middleware/
│   │   ├── authMiddleware.ts # JWT auth + role guard
│   │   └── errorMiddleware.ts# Global error handler
│   ├── modules/
│   │   └── management/
│   │       ├── auth/         # ← Full reference module
│   │       │   ├── index.ts
│   │       │   ├── auth.routes.ts
│   │       │   ├── auth.controller.ts
│   │       │   ├── auth.service.ts
│   │       │   ├── auth.auth.service.ts  # JWT + bcrypt helpers
│   │       │   ├── auth.repo.ts
│   │       │   ├── auth.schema.ts
│   │       │   ├── auth.interface.ts
│   │       │   └── auth.constants.ts
│   │       └── user/         # ← CRUD reference module
│   │           ├── index.ts
│   │           ├── user.routes.ts
│   │           ├── user.controller.ts
│   │           ├── user.service.ts
│   │           ├── user.repo.ts
│   │           ├── user.schema.ts
│   │           ├── user.interface.ts
│   │           └── user.constants.ts
│   ├── routes/
│   │   └── routes.ts         # /v1 router
│   ├── shared/
│   │   ├── constants/
│   │   │   ├── index.ts      # HTTP_STATUS, RESPONSE_MESSAGES
│   │   │   └── authErrorCodes.ts
│   │   └── utils/
│   │       ├── apiResponse.ts   # sendSuccess / sendError
│   │       ├── asyncWrapper.ts  # async try/catch wrapper
│   │       └── dbOperation.ts   # Prisma error mapper
│   ├── types/
│   │   └── index.ts          # AuthenticatedRequest, AdminAuthRequest
│   └── utils/
│       └── logger.ts         # Winston logger
├── tests/
│   ├── integration/
│   │   └── auth.test.ts
│   └── unit/
│       └── auth/
│           └── auth.auth.service.test.ts
├── docs/
│   └── swagger.yaml          # OpenAPI 3.0 spec
├── .env.example
├── .gitignore
├── CLAUDE.md                 # AI assistant guidance
├── jest.config.js
├── package.json
└── tsconfig.json
```

---

## Module Convention

Every feature module follows this file structure:

```
<feature>/
  index.ts               # re-exports routes (barrel)
  <feature>.routes.ts    # Express Router + middleware
  <feature>.controller.ts# Thin handlers — validate → delegate → respond
  <feature>.service.ts   # Business logic (calls repo)
  <feature>.repo.ts      # All Prisma queries (only layer touching DB)
  <feature>.schema.ts    # Zod request schemas
  <feature>.interface.ts # TypeScript types/interfaces
  <feature>.constants.ts # Messages, SELECT shapes, config
```

### Data flow

```
Request → Router → Middleware → Controller → Service → Repo → Prisma → DB
```

**Rules:**
- Controllers **only** validate input and call services
- Services **only** call repos and apply business rules
- Repos **only** call Prisma
- Throw `AppError` for all handled errors — never `res.status(500)` manually

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables. The server **will not start** if any required variable is missing.

---

## Adding a New Module

1. Create `src/modules/<namespace>/<feature>/` directory
2. Add the 8 standard files (copy from `user/` module as template)
3. Register routes in `src/routes/routes.ts`
4. Add Prisma model to `prisma/schema.prisma` and run migration

---

## API Endpoints

| Method | Path                        | Auth       | Description           |
|--------|-----------------------------|------------|-----------------------|
| GET    | /v1/health                  | Public     | Health check          |
| POST   | /v1/auth/login              | Public     | Login                 |
| POST   | /v1/auth/refresh-token      | Public     | Rotate refresh token  |
| POST   | /v1/auth/logout             | Public     | Logout                |
| POST   | /v1/auth/logout-all         | Bearer     | Revoke all sessions   |
| POST   | /v1/auth/forgot-password    | Public     | Request OTP           |
| POST   | /v1/auth/verify-otp         | Public     | Verify OTP            |
| POST   | /v1/auth/reset-password     | Public     | Reset password        |
| POST   | /v1/auth/change-password    | Bearer     | Change password       |
| GET    | /v1/users                   | ADMIN, MGR | List users            |
| GET    | /v1/users/:uuid             | Bearer     | Get user              |
| POST   | /v1/users                   | ADMIN      | Create user           |
| PUT    | /v1/users/:uuid             | ADMIN, MGR | Update user           |
| DELETE | /v1/users/:uuid             | ADMIN      | Delete user           |
