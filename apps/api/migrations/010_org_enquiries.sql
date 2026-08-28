-- Enquiries from organisations that want to buy Cleat.
--
-- The organisation page offered two `mailto:` links and nothing else, on a
-- domain that is not registered. Every clinic that tried to get in touch was
-- writing to an address that bounces, and there was no record anywhere that
-- they had tried. This is the only conversion event the commercial side of
-- the product has, so it gets a table.
--
-- Deliberately outside the tenant model, and this is not an oversight of the
-- kind the migration invariant test looks for. The person filling this in has
-- no account and belongs to no tenant — that is the whole point of a sales
-- enquiry. There is no tenant_id to scope it by, so it is confined to
-- `withoutTenant()` like `tenants` and `tenant_billing`, and no end-user
-- request reads it.
--
-- What it holds is a working person's name, work contact details and whatever
-- they chose to type. That is not patient data, but it is personal data, and
-- the free text is the field where somebody will eventually describe their
-- unit's caseload — so it is encrypted at rest with the same key ring as the
-- clinical free text, and the retention window below is short on purpose.

CREATE TABLE org_enquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  organisation text NOT NULL,
  -- Stored lowercased so "Anna@Klinik.se" and "anna@klinik.se" are one person
  -- when an operator goes looking.
  contact_email text NOT NULL,
  contact_name text NOT NULL,
  -- Optional. Asking for a phone number to get a price is friction with no
  -- purpose; some people offer one anyway.
  contact_phone text,
  -- Roughly how many people they would need seats for. Free text rather than
  -- an integer, because "ungefär 40, men vi växer" is a real answer and
  -- forcing it into a number loses the useful half.
  seats_estimate text,
  -- Encrypted. See the note above.
  message      text,

  -- Operational state, so an enquiry cannot be silently dropped. `new` until
  -- somebody picks it up.
  status       text NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'contacted', 'won', 'lost', 'spam')),
  -- Whether the notification mail actually left. An enquiry that is stored but
  -- never announced is an enquiry nobody answers, and that failure has to be
  -- visible rather than inferred from silence.
  notified_at  timestamptz,

  -- Kept for abuse handling only, and only in truncated form: enough to spot a
  -- flood from one network, not enough to be a location history. Dropped with
  -- the row.
  source_prefix text
);

-- An operator's first question is "what came in and has anyone answered it".
CREATE INDEX org_enquiries_triage_idx ON org_enquiries (status, created_at DESC);
-- The second is "have these people written before".
CREATE INDEX org_enquiries_email_idx ON org_enquiries (contact_email);
