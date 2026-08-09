-- Shared login-failure counters.
--
-- The first implementation kept these in a Map inside the process, which meant
-- the ceiling multiplied by replica count: five failures per account became
-- fifteen across three pods, and an attacker who reconnects lands on a
-- different pod with a fresh budget. A brake whose strength depends on how many
-- replicas happen to be running is not a brake you can reason about.
--
-- Deliberately NOT tenant-scoped, and so deliberately not under row-level
-- security: the counter is consulted before a tenant is resolved, and keying it
-- per tenant would let anyone who can name a second tenant reset their own
-- budget. The table holds no personal data beyond an address that already
-- failed to log in, and rows expire.

CREATE TABLE login_failures (
  -- 'account:<lowercased email>' or 'ip:<address>'. One table for both so the
  -- expiry and cleanup logic exists once.
  key        text PRIMARY KEY,
  failures   integer NOT NULL DEFAULT 0,
  reset_at   timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_failures_reset_idx ON login_failures (reset_at);

-- Records a failure and returns the running count in one round trip. The
-- upsert is what makes it safe under concurrency: two pods failing the same
-- account at the same moment both count, rather than one silently overwriting
-- the other's increment.
CREATE OR REPLACE FUNCTION record_login_failure(p_key text, p_window interval)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  current_failures integer;
BEGIN
  INSERT INTO login_failures (key, failures, reset_at)
       VALUES (p_key, 1, now() + p_window)
  ON CONFLICT (key) DO UPDATE
          SET failures = CASE
                           WHEN login_failures.reset_at <= now() THEN 1
                           ELSE login_failures.failures + 1
                         END,
              reset_at = CASE
                           WHEN login_failures.reset_at <= now() THEN now() + p_window
                           ELSE login_failures.reset_at
                         END,
              updated_at = now()
    RETURNING failures INTO current_failures;
  RETURN current_failures;
END;
$$;
