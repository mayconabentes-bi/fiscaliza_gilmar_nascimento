-- DRAFT: additive, private, fail-closed issuance for supervised field registrations.
-- Apply ONLY to isolated homologation after review. Production requires separate approval.
BEGIN;
CREATE TABLE IF NOT EXISTS private.field_registration_tickets (
  id uuid PRIMARY KEY,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  assessor_id uuid NOT NULL REFERENCES private.admins(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  citizen_id uuid UNIQUE REFERENCES public.usuarios(id),
  CHECK (expires_at > issued_at),
  CHECK ((consumed_at IS NULL AND citizen_id IS NULL) OR (consumed_at IS NOT NULL AND citizen_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS field_registration_issued_by_time_idx
  ON private.field_registration_tickets (assessor_id, issued_at DESC);
ALTER TABLE private.field_registration_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.field_registration_tickets FROM PUBLIC, anon, authenticated;
COMMIT;
