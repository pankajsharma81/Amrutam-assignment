CREATE UNIQUE INDEX "consultations_slot_active_key"
ON "consultations" ("slot_id")
WHERE "status" <> 'CANCELLED';