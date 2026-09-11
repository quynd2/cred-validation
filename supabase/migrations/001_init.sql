-- LiveStreamer License Server — initial schema
-- Run in Supabase SQL Editor or via supabase db push

-- ── Revoked licenses ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revoked_licenses (
  kid        TEXT PRIMARY KEY,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason     TEXT
);

-- ── Machine activations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kid              TEXT        NOT NULL,
  machine_id       TEXT        NOT NULL,
  machine_name     TEXT,
  plan             TEXT        NOT NULL,
  modules          TEXT[]      NOT NULL,
  max_accounts     INT         NOT NULL,
  max_activations  INT         NOT NULL,
  expires_at       DATE,
  activated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,

  UNIQUE (kid, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_activations_kid ON activations (kid);

-- ── YouTube accounts (global per license) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS license_accounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kid                 TEXT        NOT NULL,
  machine_id          TEXT        NOT NULL,
  youtube_channel_id  TEXT        NOT NULL,
  channel_name        TEXT,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same channel cannot be on the same license twice (across machines)
  UNIQUE (kid, youtube_channel_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_kid ON license_accounts (kid);

-- ── Admin view ────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW license_summary AS
SELECT
  a.kid,
  a.machine_id,
  a.machine_name,
  a.plan,
  a.modules,
  a.expires_at,
  a.activated_at,
  a.last_heartbeat,
  a.is_active,
  (r.kid IS NOT NULL) AS is_revoked,
  COUNT(la.id)::INT   AS account_count
FROM activations a
LEFT JOIN license_accounts la ON la.kid = a.kid
LEFT JOIN revoked_licenses  r  ON r.kid = a.kid
GROUP BY a.id, r.kid;

-- ── RLS: disable for service_role (API routes use service_role key) ───────────
ALTER TABLE revoked_licenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_accounts   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically — no policies needed for API routes
