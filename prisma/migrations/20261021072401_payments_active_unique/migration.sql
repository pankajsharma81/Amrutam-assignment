-- This is an empty migration.

CREATE UNIQUE INDEX "payments_consultation_active_key"
ON "payments" ("consultation_id")
WHERE "status" IN ('PENDING', 'SUCCEEDED');