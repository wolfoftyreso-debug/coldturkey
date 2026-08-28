-- Bring the billing tables under the same isolation rule as everything else.
--
-- 007 left them outside row-level security, reasoning that the webhook handler
-- answers Stripe rather than a signed-in user and so has no tenant context. The
-- suite's own invariant — every table carrying `tenant_id` is FORCE ROW LEVEL
-- SECURITY — disagreed, and it was right: the handler resolves the tenant from
-- Stripe's payload before it writes anything, so it can perfectly well do that
-- work inside the tenant's context. An exemption would have been the first hole
-- in a rule that is otherwise absolute, and holes in that rule are how one
-- clinic's data reaches another.
--
-- Events that cannot be attributed to a tenant are no longer recorded at all.
-- They are ignored by the handler anyway, so replaying one changes nothing and
-- the ledger loses no protection it was providing.
DELETE FROM billing_events WHERE tenant_id IS NULL;

ALTER TABLE billing_events
  ALTER COLUMN tenant_id SET NOT NULL,
  -- The ledger must outlive nothing: if the tenant goes, so does its history.
  DROP CONSTRAINT billing_events_tenant_id_fkey,
  ADD CONSTRAINT billing_events_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenant_billing', 'billing_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END
$$;
