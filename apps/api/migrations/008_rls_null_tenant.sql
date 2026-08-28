-- Make "no tenant context" mean no rows, which is what the policies already
-- claim to do.
--
-- Every policy compares `tenant_id` to `current_setting('app.tenant_id', true)::uuid`,
-- and `withTenant` sets that value transaction-locally with `set_config(..., true)`.
-- The intent, documented in 001_init, is that a query without a tenant context
-- hits a NULL predicate and returns nothing.
--
-- That is true on a connection that has never carried a tenant. It is not true
-- afterwards: PostgreSQL reverts a transaction-local custom GUC to the empty
-- string rather than to unset, so on any pooled connection that has already
-- served one request the policy evaluates `''::uuid` and the query raises
--
--     invalid input syntax for type uuid: ""
--
-- rather than returning zero rows. The isolation still holds — it fails closed,
-- loudly — but it fails as a 500 on a code path that expected an empty result,
-- and only after the pool has warmed up, which is the hardest kind of bug to
-- see in staging and the easiest to hit in production.
--
-- `nullif(..., '')` restores the documented behaviour: unset and empty both
-- become NULL, the predicate is NULL, and the query returns nothing.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'refresh_tokens', 'profiles', 'quits', 'relapses',
    'check_ins', 'cravings', 'triggers', 'support_contacts',
    'coach_messages', 'audit_log', 'life_domains', 'account_tokens',
    'totp_recovery_codes', 'login_challenges'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END
$$;
