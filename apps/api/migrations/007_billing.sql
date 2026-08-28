-- Commercial state: who is paying, for how many seats, and whether it worked.
--
-- Cleat's model is deliberately lopsided. A person in recovery never pays and
-- never meets a paywall; organisations — clinics, treatment centres,
-- occupational health — buy a tenant with a seat count. So billing hangs off
-- `tenants`, never off `users`, and nothing in this file touches a person's
-- clinical record.
--
-- Deliberately NOT row-level secured, and that is the same reasoning as the
-- `tenants` table above it: billing is resolved outside a tenant context, by
-- the webhook handler, which is answering Stripe rather than a signed-in user.
-- Access is confined to `withoutTenant()`. No end-user request reads this table
-- directly — the API turns it into an entitlement before the product sees it.

CREATE TABLE tenant_billing (
  tenant_id              uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  -- Stripe's identifiers. Nullable because a tenant exists before it ever pays,
  -- and a trialling clinic has no customer record yet.
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  -- Stripe's own subscription status, stored verbatim rather than mapped, so a
  -- future status we have not thought about is visible rather than silently
  -- collapsed into something wrong.
  stripe_status          text,
  -- Seats the subscription is actually billed for.
  seats                  integer NOT NULL DEFAULT 0 CHECK (seats >= 0),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Every Stripe event we have already acted on.
--
-- Stripe retries, and it is explicitly allowed to deliver the same event more
-- than once; a webhook endpoint that is not idempotent will happily grant a
-- second subscription or double a seat count on a redelivery. The primary key
-- is Stripe's event id, so a replay collides instead of executing.
CREATE TABLE billing_events (
  stripe_event_id text PRIMARY KEY,
  type            text NOT NULL,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,
  -- What we did about it, for the operator who has to answer "what happened to
  -- this customer's payment?" a month from now without guessing.
  outcome         text NOT NULL,
  received_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX billing_events_received_idx ON billing_events (received_at DESC);
CREATE INDEX billing_events_tenant_idx ON billing_events (tenant_id, received_at DESC);

-- The plan column already exists on `tenants` and is the single value product
-- code reads. Billing updates it; nothing else does. Constrain it now that it
-- carries commercial meaning, so a typo cannot quietly grant a paid plan.
ALTER TABLE tenants
  ADD CONSTRAINT tenants_plan_known
  CHECK (plan IN ('standard', 'clinic', 'clinic_trial', 'suspended'));
