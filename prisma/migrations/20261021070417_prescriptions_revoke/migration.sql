-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "revoked_reason" TEXT;

CREATE UNIQUE INDEX "prescriptions_consultation_active_key"
ON "prescriptions" ("consultation_id")
WHERE "revoked_at" IS NULL;