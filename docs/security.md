# Security: Checklist and Threat Model

Status legend: **[Done]** is in code. **[Partial]** is partly done. **[Planned]** is documented, not built.

## 1. Data classification

| Class | Examples | Handling |
|---|---|---|
| Restricted (health data) | consultation notes, prescription medications and instructions | AES-256-GCM field encryption before insert (`notes_enc`, `medications_enc`, `instructions_enc`); decrypted only for the treating doctor or the owning patient; never logged |
| Secret | passwords, refresh tokens, MFA secrets, email verification tokens | passwords: bcrypt; refresh tokens: hashed in DB; MFA secret: AES-256-GCM (`mfa_secret_enc`); verification tokens: SHA-256 hash only |
| Personal | name, email, phone | access restricted by role; email normalised and unique; soft delete |
| Operational | audit logs, metrics | audit rows contain ids and hashes, not payloads (login failures store `sha256(email)`) |

## 2. OWASP-aligned checklist

| Area | Control | Status |
|---|---|---|
| A01 Broken access control | RBAC middleware (`requireRole`) on every route; service layer re-checks ownership (patient sees only own consultations, doctor only own slots and consultations, others get 404 not 403 to avoid id probing); ADMIN cannot be self-registered; admin cannot demote or delete self | Done |
| A01 | Slot, doctor and payment endpoints filter by owner in the query, not after fetching | Done |
| A02 Cryptographic failures | AES-256-GCM with random IV and auth tag; key id prefix in every ciphertext (`keyId:iv:tag:data`) so keys rotate without downtime (`ENCRYPTION_PREVIOUS_KEYS`); bcrypt cost from env; JWT secrets validated ≥ 32 chars at boot | Done |
| A02 | TLS termination at the ingress / load balancer; HSTS via helmet | Partial (TLS configured at deploy, not in repo) |
| A03 Injection | Prisma parameterised queries; the two raw SQL statements use tagged templates with bound parameters; every request body, query and param is validated with strict Zod schemas | Done |
| A04 Insecure design | State machines with compare-and-set updates; DB partial unique indexes as the last line of defence against double booking | Done |
| A05 Misconfiguration | `helmet()`; CORS allow-list from `CORS_ORIGINS`; body size limit 3 MB; stack traces only when `NODE_ENV=development`; Swagger disabled in production; env validated at startup (process exits on bad config); non-root container user | Done |
| A06 Vulnerable components | `npm audit --omit=dev --audit-level=critical` and Trivy image scan in CI; `bcrypt@6` (no `tar` chain), `nodemailer@10`. Open items listed in section 5 | Partial |
| A07 Authentication failures | Access (15 min) and refresh (7 d) tokens with separate secrets, HS256 pinned, `typ` claim checked; refresh rotation with reuse detection (reuse revokes every session of that user); account lockout after 5 failures for 15 min; generic "Invalid credentials"; dummy hash on unknown email to equalise timing; password change revokes all sessions; per-route rate limits (register 10/h, login 10/15 min, refresh, MFA, webhook) | Done |
| A07 MFA | TOTP (RFC 6238) opt-in: enroll, confirm, verify; secret encrypted at rest; short-lived `typ:'mfa'` challenge token; failed-attempt counter shared with lockout; used codes rejected for 90 s through Redis (replay protection) | Done |
| A07 | Enforce MFA for DOCTOR and ADMIN roles | Planned |
| A08 Integrity failures | Payment webhook authenticated with HMAC-SHA256 over the raw body, constant-time comparison (`timingSafeEqual`); rejected attempts are audited | Done |
| A09 Logging and monitoring | Audit log for login success/failure, role change, delete, booking, payment intent, webhook, prescription create/revoke; each row carries actor, role, IP and request id; Prometheus metrics | Done |
| A10 SSRF | The server makes no user-controlled outbound requests | Done |
| Idempotency and replay | Mandatory `Idempotency-Key` on money and booking writes; replayed webhooks are no-ops | Done |
| Secrets management | All secrets from environment variables; `.env` git-ignored; `.env.example` has placeholders only; CI uses throwaway values | Done |
| Secret store and rotation | Move env secrets to a managed secret store; rotate JWT secrets with an overlap window | Planned |

## 3. Threat model (STRIDE)

Assets: patient health data, credentials and sessions, payment state, slot inventory, audit trail. Trust boundaries: Internet to API, API to Postgres/Redis, payment provider to API (webhook).

| # | Threat | Category | Mitigation | Residual risk |
|---|---|---|---|---|
| T1 | Credential stuffing / brute force on login | Spoofing | lockout 5/15 min, login rate limit, generic error, bcrypt, optional MFA | Distributed attacks across many accounts slip under per-IP limits; mitigated by lockout being per-account |
| T2 | Stolen refresh token | Spoofing | rotation on every use; reuse of an old token revokes all sessions; tokens stored hashed server-side | Token theft within its first use window |
| T3 | Stolen access token | Spoofing | 15-minute lifetime | Valid until expiry even after logout (stateless JWT); a deny-list keyed by session id is the planned fix |
| T4 | Forged JWT or algorithm confusion | Spoofing | HS256 pinned on sign and verify; separate secrets for access and refresh; `typ` claim enforced so a refresh or MFA token cannot be used as an access token | Secret leakage; see rotation plan |
| T5 | Horizontal privilege escalation (patient reads another patient's consultation or prescription) | Elevation / Info disclosure | ownership checks in service layer; unauthorised ids return 404 | None known |
| T6 | Vertical escalation (self-registering as ADMIN, mass assignment) | Elevation | register role limited to PATIENT or DOCTOR; `.strict()` Zod schemas reject unknown fields; admin-only routes behind `requireRole('ADMIN')` | Insider with DB access |
| T7 | Double booking via race condition | Tampering | atomic conditional update + partial unique index; covered by an integration test | None known |
| T8 | Duplicate charge or booking through client retries | Tampering | idempotency keys with request hashing; payment unique index per live consultation | Keys are per user and expire after 24 h |
| T9 | Forged payment webhook | Spoofing / Tampering | HMAC signature on raw body, constant-time compare, rate limited, rejected calls audited | Shared-secret leak; rotate on suspicion |
| T10 | Refund over-spend | Tampering | single SQL `UPDATE` with `refunded_amount + x <= amount` in the `WHERE` | None known |
| T11 | Database dump exposes health data | Info disclosure | field-level AES-256-GCM, keys outside the database, key rotation supported | Key and database compromised together |
| T12 | Sensitive data in logs | Info disclosure | no request bodies logged; audit stores hashes of emails; stack traces off outside development | Developer adds a careless log line; code review item |
| T13 | User repudiation ("I did not do that") | Repudiation | audit log with actor, role, IP, request id, resource id for all sensitive actions | Audit table is mutable by DB admins; ship rows to append-only storage (planned) |
| T14 | DoS by flooding or heavy queries | DoS | global (100 / 15 min) and per-route rate limits, 3 MB body cap, pagination caps (max 50 to 100), bounded date ranges on slot and analytics queries, cache on hot reads | Limits are per process until Redis-backed; L7 DDoS needs a CDN/WAF in front |
| T15 | Account enumeration | Info disclosure | identical response and timing for unknown email and wrong password; registration conflict is the only disclosure | Registration reveals existing emails (accepted trade-off; mitigate with captcha) |
| T16 | Cross-site request or CORS abuse | Tampering | bearer tokens in the `Authorization` header (not cookies), so CSRF does not apply; strict CORS allow-list | None known |
| T17 | Supply-chain compromise | Tampering | lockfile, `npm ci`, audit and Trivy in CI | Transitive zero-days |

## 4. Verification

- Automated: `tests/integration/booking.test.ts` (concurrent booking, idempotent replay, key reuse, missing key), `tests/integration/auth.test.ts`, `tests/unit/auth`.
- CI: type-check, tests against real Postgres and Redis, `npm audit`, container build and Trivy scan.
- Manual checks done through Postman: role checks per route, token reuse, lockout, logout-all.

## 5. Known limitations and accepted risks

| Item | Why accepted | Plan |
|---|---|---|
| `prisma` CLI pulls `deepmerge-ts` (high, stack exhaustion) | Fix needs Prisma 7 (major, breaking). Affects config parsing of the CLI, which runs only at start-up for `migrate deploy`, never on request-serving paths | Upgrade to Prisma 7 in a dedicated change with the full test suite |
| `yamljs` → `sprintf-js` (moderate) | Used only to load our own `swagger.yaml`; Swagger is off in production | Replace with `js-yaml` |
| Dev-only advisories (jest, nodemon, braces) | Not present in the production image (`npm ci --omit=dev`) | Bump with the next toolchain update |
| Access token valid up to 15 min after logout | Stateless JWT trade-off | Session-id deny-list in Redis |
| Rate limiting in process memory | Fine for one replica | Redis store so limits are global |
| MFA optional | Rollout choice | Require for DOCTOR and ADMIN |
| Audit log in the same database | Simplicity | Stream to append-only object storage with object lock |
| No automatic expiry of unpaid bookings | Not built yet | Scheduled job (see architecture doc) |