-- In-app "Mua mã" order flow (v1.32). The app asks for an order code, shows a
-- VietQR whose transfer memo IS that code, then polls until the SePay webhook
-- marks the row paid and attaches a freshly minted key.
--
-- COLD-ish: one row per purchase attempt. The nightly cron drops stale rows.
CREATE TABLE IF NOT EXISTS license_order (
  code         TEXT    NOT NULL PRIMARY KEY,        -- TIOxxxxxx, goes in the bank memo
  amount       INTEGER NOT NULL,                    -- VND expected
  status       TEXT    NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'expired'
  key          TEXT,                                -- minted BUMBUM-... once paid
  fp           TEXT,                                -- machine fp that opened the order (poll must match)
  created_at   INTEGER NOT NULL,                    -- unix seconds
  paid_at      INTEGER,
  paid_ref     TEXT,                                -- SePay referenceCode
  paid_amount  INTEGER                              -- what actually arrived
) STRICT;

CREATE INDEX IF NOT EXISTS license_order_status ON license_order(status, created_at);
