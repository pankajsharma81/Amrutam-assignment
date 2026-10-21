# Amrutam Telemedicine Backend

Production-oriented backend for a telemedicine platform: authentication with MFA, doctor availability and booking, consultation lifecycle, encrypted prescriptions, payments, audit trail and admin analytics.

Stack: Node.js 20, Express 5, TypeScript, Prisma 6, PostgreSQL 16, Redis 7, Zod, Prometheus and Grafana, Docker, GitHub Actions.

## Documentation

| Doc | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | architecture, booking sequence diagram, ER diagram, concurrency, idempotency, sagas, retry/backoff, caching, partitioning, backup/DR |
| [`docs/security.md`](docs/security.md) | security checklist, threat model, accepted risks |
| [`docs/swagger.yaml`](docs/swagger.yaml) | OpenAPI contract (live UI at `/api-docs` when not in production) |
| `docs/Amrutam.postman_collection.json` | one request per route, ready to import |

## Quick start (Docker, everything)

```bash
cp .env.example .env
# set real values for JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY, PAYMENT_WEBHOOK_SECRET
# generate each with: openssl rand -hex 32

docker compose up -d --build
npm install
npm run prisma:seed
```

| Service | URL |
|---|---|
| API | http://localhost:3000/v1 |
| Health / readiness | http://localhost:3000/v1/health/ready |
| Metrics | http://localhost:3000/metrics |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin / admin) |
| Postgres (host) | localhost:5433 |
| Redis | localhost:6379 |

The API container runs `prisma migrate deploy` on start. Seeding runs from the host against port 5433 because the production image has no dev tooling.

`NODE_ENV=production` inside the compose file disables Swagger UI. Set it to `development` in `docker-compose.yml` if you want `/api-docs` in the demo.

## Local development (API on host, infra in Docker)

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Set the generated secrets in `.env`; the app refuses to start on missing or weak config and prints which variables are wrong.

## Seed accounts

| Role | Email | Password |
|---|---|---|
| ADMIN | admin@demo.com | Admin@123 |
| PATIENT | patient1@example.com, patient2@example.com | Patient@123 |
| DOCTOR (verified) | dr.asha@amrutam.com, dr.rohan@amrutam.com, dr.meera@amrutam.com, dr.kiran@amrutam.com | Doctor@123 |
| DOCTOR (not verified) | dr.pending@amrutam.com | Doctor@123 |

Verified doctors have 18 free slots over the next three days. These credentials are for local development only.

## Try the main flow

1. `POST /v1/auth/login` as `patient1@example.com`, copy `access_token`.
2. `GET /v1/doctors` and pick a doctor `uuid`.
3. `GET /v1/doctors/{uuid}/slots` and pick a slot `uuid`.
4. `POST /v1/consultations` with `{ "slot_uuid": "..." }`, headers `Authorization: Bearer <token>` and `Idempotency-Key: <any 8-128 char string>`. Repeat the same call: you get the same response with `Idempotent-Replay: true`. Try the same slot as `patient2`: `409`.
5. `POST /v1/payments/intent` with `{ "consultation_uuid": "..." }`.
6. Simulate the provider webhook (HMAC-SHA256 of the raw body with `PAYMENT_WEBHOOK_SECRET`, sent as `X-Signature`):
   ```bash
   BODY='{"event":"payment.succeeded","provider_ref":"<provider_ref from step 5>"}'
   SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" -hex | awk '{print $NF}')
   curl -X POST localhost:3000/v1/payments/webhook -H "Content-Type: application/json" -H "X-Signature: $SIG" -d "$BODY"
   ```
   The consultation becomes `CONFIRMED`.
7. As the doctor: `PATCH /v1/consultations/{uuid}/start`, `PUT .../notes`, `PATCH .../complete`, `POST /v1/consultations/{uuid}/prescription`.
8. As admin: `GET /v1/admin/audit-logs`, `GET /v1/admin/analytics/overview`.

## Endpoint overview

| Area | Routes |
|---|---|
| Auth | `POST /auth/register, /login, /refresh-token, /logout, /logout-all, /change-password, /mfa/enroll, /mfa/confirm, /mfa/verify` |
| Users | `GET/PATCH /users/me`; admin: `GET /users`, `GET/DELETE /users/:uuid`, `PATCH /users/:uuid/role` |
| Doctors | `GET /doctors`, `POST /doctors`, `GET/PATCH /doctors/:uuid`, `PATCH /doctors/:uuid/verify` |
| Slots | `POST/GET /doctors/:uuid/slots`, `PATCH/DELETE /slots/:uuid` |
| Consultations | `POST/GET /consultations`, `GET /consultations/:uuid`, `PATCH /:uuid/cancel, /reschedule, /start, /complete`, `PUT /:uuid/notes` |
| Prescriptions | `POST/GET /consultations/:uuid/prescription`, `GET /prescriptions/:uuid`, `PATCH /prescriptions/:uuid/revoke` |
| Payments | `POST /payments/intent`, `POST /payments/webhook`, `GET /payments[/:uuid]`, `POST /payments/:uuid/refund` |
| Admin | `GET /admin/audit-logs`, `GET /admin/analytics/overview, /doctors, /funnel` |
| Ops | `GET /health`, `/health/live`, `/health/ready`, `/metrics` |

Writes that create bookings or move money (`POST /consultations`, `/payments/intent`, `/payments/:uuid/refund`, prescription create) require an `Idempotency-Key` header.

## Tests

```bash
docker compose up -d postgres redis
docker compose stop api
npm run prisma:seed
npm test
```

Integration tests use the real database and the seed accounts. The booking suite proves that two concurrent bookings of one slot yield exactly one `201` and one `409`, and that a repeated `Idempotency-Key` replays the stored response without creating a second consultation.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: install, `prisma migrate deploy`, seed, type-check, tests against real Postgres and Redis service containers, `npm audit` (critical gate), then a Docker build with a Trivy scan (high and critical).

## Configuration

All configuration is environment variables, validated at start-up (`src/config/env.ts`). See `.env.example`. Never commit `.env`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `REDIS_URL` | data stores |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | token signing, at least 32 characters, different from each other |
| `ENCRYPTION_KEY`, `ENCRYPTION_KEY_ID`, `ENCRYPTION_PREVIOUS_KEYS` | field encryption, 64 hex characters; previous keys as `id:hex,id:hex` for rotation |
| `PAYMENT_WEBHOOK_SECRET` | HMAC secret for payment webhooks |
| `CORS_ORIGINS` | comma-separated allow-list |
| `METRICS_TOKEN` | optional bearer token protecting `/metrics` |
| `EMAIL`, `EMAIL_PASSWORD`, `EMAIL_SENDER` | SMTP; email is skipped when not configured |

## Project layout

```
src/
  app.ts                 server bootstrap, middleware, graceful shutdown
  config/                env validation, Prisma, Redis, Swagger
  middleware/            auth + RBAC, idempotency, request id, metrics, errors
  modules/<feature>/     routes, controller, service, repo, schema
  shared/                crypto, cache, audit, metrics, response helpers
prisma/                  schema, migrations, seed
tests/                   unit and integration tests
monitoring/              Prometheus and Grafana provisioning
docs/                    architecture, security, OpenAPI
```

## Known limitations

See the last section of `docs/architecture.md` and section 5 of `docs/security.md`. In short: unpaid bookings do not auto-expire, access tokens live up to 15 minutes after logout, rate limiting is per process, MFA is opt-in, and the `prisma` CLI carries one accepted high advisory pending a Prisma 7 upgrade.