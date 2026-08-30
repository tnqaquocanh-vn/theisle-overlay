-- Supporter license keys (v1.31). COLD table: written only on mint / rebind /
-- revoke — a handful of rows ever. Index freely.
CREATE TABLE IF NOT EXISTS license (
  key         TEXT    NOT NULL PRIMARY KEY,      -- BUMBUM-XXXX-XXXX-XXXX
  tier        TEXT    NOT NULL DEFAULT 'supporter',
  email       TEXT,                              -- Ko-fi donor email, or a note for manual keys
  fp          TEXT,                              -- machine fingerprint currently bound (null = unbound)
  fp_month    TEXT,                              -- 'YYYY-MM' the rebind counter belongs to
  fp_rebinds  INTEGER NOT NULL DEFAULT 0,        -- rebinds so far this fp_month (limit 2)
  issued_at   INTEGER NOT NULL,                  -- unix seconds
  source      TEXT    NOT NULL DEFAULT 'manual', -- 'manual' | 'kofi'
  sent_at     INTEGER,                           -- when the maintainer delivered it (manual bookkeeping)
  revoked     INTEGER NOT NULL DEFAULT 0,
  note        TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS license_email  ON license(email);
CREATE INDEX IF NOT EXISTS license_source ON license(source, sent_at);
