-- Rebuild my life — per-domain progress.
--
-- The fifth mode needs somewhere to keep "I am working on sleep, I have not
-- touched money yet". One row per person per domain; the note is the person's
-- own words and is treated as recovery data like everything else here.

CREATE TABLE life_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain     text NOT NULL,
  status     text NOT NULL DEFAULT 'untouched'
               CHECK (status IN ('untouched', 'working', 'steady')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX life_domains_unique ON life_domains (user_id, domain);
CREATE INDEX life_domains_user_idx ON life_domains (user_id);

-- Same isolation as every other tenant-scoped table: FORCE so the policy holds
-- even when the application connects as the table owner.
ALTER TABLE life_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_domains FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON life_domains
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
