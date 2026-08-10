# Security Readiness Report — Cleat

**Date:** 2026-08-10 · **Commit:** the one adding this file · **Scope:** API, web,
mobile, database, Kubernetes platform, CI/CD.

## Final status: **SECURITY NOT READY**

Every blocking control that can be verified in code has been verified by
attacking a running system and by regression tests. Encryption at rest was the
last blocker that was engineering work, and it is now done and proven against
a real database. What remains cannot be verified from inside this repository
by anyone.

**What blocks readiness:**

| # | Blocker | Why it cannot be closed here |
|---|---|---|
| B1 | No independent penetration test | Requires an external party. Everything below was probed by the same person who wrote it. |
| B2 | No clinical review of safety triage | Requires clinical competence in addiction and suicide prevention. Wrong triage is a safety failure, not only a security one. |
| B3 | No DPIA, privacy policy, terms, or processor agreement | Health data is Article 9 special category. Required before the first real user. |
| ~~B4~~ | ~~No field-level encryption at rest~~ | **CLOSED.** See F6 below. |

Nothing on that list is a code defect. They are the three things a person
holding this report should not be talked out of.

---

## 1. Findings, with root cause, fix and regression test

Ordered by severity. Every "fixed" row was demonstrated open before the fix
and demonstrated closed after, against a running server.

### F6 — Sensitive text stored in cleartext · HIGH · FIXED

**Attack.** Not a live one. A backup restored on a laptop, a replica on a
decommissioned disk, a snapshot in an object store, or an operator running a
SELECT — every one of which sees coach transcripts and relapse notes in full,
and none of which row level security touches.

**Root cause.** Encryption at rest was treated as a storage-layer concern.
`pgcrypto` was installed and unused; encrypting inside the database with a key
the database can read protects against nothing.

**Fix.** AES-256-GCM at the application layer, key from the secret store and
never in Postgres. Encrypted: `coach_messages.content`, `profiles.why_statement`,
`cravings.note`, `relapses.note`, and support contacts' name, phone and note —
third-party personal data about people who never signed up for anything. The
AAD binds every value to `tenant/table/column/owner`, so a ciphertext cannot be
transplanted between rows or columns. Keys are versioned for lazy rotation. The
API refuses to start in production without one.

**Regression test.** `app.test.ts` → "sensitive text is ciphertext at rest"
writes each field through the API, then reads the raw columns with SQL and
asserts the plaintext is absent — bypassing every application code path,
because a decrypt-on-read that happens to work would satisfy any weaker check.
A second test reads it all back through the API and asserts the person gets
their own words, and a third asserts the data export contains plaintext rather
than envelopes. A fourth fails the suite outright if it is run without keys,
since the at-rest assertions would otherwise pass by finding nothing.
`crypto/field.test.ts` covers the envelope: nonce uniqueness, tamper
detection, transplant rejection, rotation, and refusal of a short key.

**Verified.** Boot with `NODE_ENV=production` and no keys exits with
`FIELD_ENCRYPTION_KEYS is required in production`.

### F1 — Account deletion needed no re-authentication · HIGH · FIXED

**Attack.** Steal or borrow an access token — an unlocked phone on a table, a
token lifted from a shared machine — and permanently destroy somebody's entire
recovery history. The endpoint asked only for a typed confirmation word, which
the frontend supplies and any attacker can read from the source.

**Root cause.** Confirmation was treated as intent verification when the
threat is identity verification. A typed word stops an accident; only a
password stops another person.

**Fix.** `DELETE /v1/privacy/account` now requires the account password and
verifies it against the stored hash before anything is deleted.

**Regression test.** `app.test.ts` → "account deletion requires the password,
not just a confirmation word": wrong password → 401, missing password → 400,
and the account is asserted alive after both.

### F2 — Arbitrary origin accepted with credentials · HIGH · FIXED

**Attack.** With the default configuration, any website a signed-in person
visits could call this API as them and read their entire record. Verified: an
`Origin: https://evil.example` request came back with
`Access-Control-Allow-Origin: https://evil.example` and
`Access-Control-Allow-Credentials: true`.

**Root cause.** `CORS_ORIGINS` defaulted to `*`, which is correct for local
development and never correct in production, and nothing prevented that
default reaching a deployment.

**Fix.** The API refuses to start in production with `CORS_ORIGINS=*`.
Credentials are only enabled when an explicit origin list is configured, so
the dangerous combination cannot be reintroduced by config alone.

**Verified.** Boot with `NODE_ENV=production CORS_ORIGINS='*'` exits with
`CORS_ORIGINS must list explicit origins in production`. Probe re-run:
`ACAO=null`.

### F3 — No Content-Security-Policy, no HSTS · MEDIUM · FIXED

**Attack.** A stored XSS anywhere in user content — a craving note, a why
statement, a support contact name — could exfiltrate the whole record to an
attacker-controlled host, because nothing constrained where the page may
connect.

**Root cause.** Helmet was registered with `contentSecurityPolicy: false`, and
the web app set four headers but neither CSP nor HSTS.

**Fix.** API: `default-src 'none'`, `frame-ancestors 'none'`, `base-uri
'none'`, `form-action 'none'` — it serves JSON, so nothing in a response can
execute even if a browser renders it. Web: `default-src 'self'` with
`connect-src` limited to the app origin and the configured API origin,
`object-src 'none'`, `frame-ancestors 'none'`, `upgrade-insecure-requests`.
HSTS one year with subdomains on both.

**Regression test.** `app.test.ts` → "serves a content security policy and
HSTS". Web headers verified against a running server.

**Known limitation, not hidden:** `script-src` retains `'unsafe-inline'`
because Next inlines its bootstrap. Removing it needs per-route nonces. The
value that matters most — `default-src 'self'` blocking exfiltration — is in
place.

### F4 — Client errors returned 500 · MEDIUM · FIXED

**Attack.** Not directly exploitable, which is why it is medium and not low:
it is an availability and detection problem. Malformed JSON, an empty body
with a JSON content-type, and an oversized body all returned 500. That tells
the caller the server broke when the request was malformed, and it feeds the
error rate that pages an on-call engineer — so real incidents hide inside
client noise.

**Root cause.** Fastify's own `FST_ERR_CTP_*` errors fell through to the
generic 500 handler.

**Fix.** Mapped to 400 and 413 with messages that do not echo internals. A
custom JSON parser now treats an empty body as no body, because many HTTP
clients set `content-type: application/json` on every request including a
DELETE — which previously meant a request was rejected before any
authorization check ran.

**Regression test.** "malformed and oversized bodies are client errors, not
500s".

### F5 — No rate limit on expensive or abusable endpoints · MEDIUM · FIXED

**Attack.** One authenticated account could issue 300 language-model calls a
minute on somebody else's bill, and 300 registrations a minute from one
address.

**Root cause.** A single global per-IP ceiling with no per-route budgets.

**Fix.** `POST /v1/coach/message` 20/minute, `POST /v1/auth/register`
30/hour, `POST /v1/public/safety/triage` 60/minute — all configurable.

**Deliberate design note.** The signup limit is generous on purpose. A tight
per-IP cap mostly punishes a household, an office or a school behind one
address and does nothing against a botnet; the control that actually bounds
fake accounts is email verification. An earlier version at 5/10 minutes broke
twelve existing tests, which is a small version of the same lesson learned
earlier on the login limiter and CGNAT.

**Verified.** Live probe. Not in the unit suite: a test that exhausts the
budget starves the rest of the file.

---

## 2. Attacks probed and blocked

Run against a live server with two real accounts, an attacker and a victim.
Full script re-runnable; results after fixes:

| ID | Attack | Result |
|---|---|---|
| IDOR-1 | Attacker PATCHes victim's craving by id | BLOCKED (404) |
| IDOR-2 | Attacker deletes victim's support contact by id | BLOCKED (404) |
| IDOR-3 | Attacker deletes victim's trigger by id | BLOCKED (404) |
| MASS-1 | `role: "owner"` at registration | BLOCKED (member) |
| MASS-2 | Privilege escalation via `PATCH /v1/me` | BLOCKED (member) |
| MASS-3 | Tenant reassignment via `PATCH /v1/me` | BLOCKED |
| AUTH-1 | 13 protected endpoints with no token | BLOCKED (all 401) |
| AUTH-2 | JWT with `alg: none` | BLOCKED (401) |
| SQLI-1 | Injection in path and query parameters | BLOCKED (no 5xx, table intact) |
| DOS-1 | 3 MB body | BLOCKED (413) |
| DOS-2 | Truncated JSON | BLOCKED (400) |
| LEAK-1 | Stack traces, SQL, paths in error responses | BLOCKED |
| CORS-1 | Arbitrary origin with credentials | BLOCKED |
| ENUM-1 | Account enumeration via forgot-password | BLOCKED (identical 202) |
| HDR-1 | Security headers | PRESENT |

**15 of 15 blocked.** The IDOR result is worth one caution: it returns 404
rather than 403, which is correct — 403 would confirm the resource exists.

**A note on how nearly this went wrong.** The first probe reported IDOR-2 and
IDOR-3 as OPEN with status 500. They were not. The probe sent
`content-type: application/json` on a DELETE with no body, so Fastify rejected
the request before the handler ran and the authorization check never
happened. A second version of the same mistake then appeared in the vitest
regression test, which read `response.id` where the API returns
`{contact: {id}}` — putting `undefined` in the URL, so an IDOR test that never
reached an authorization check would have passed forever. Both are fixed, and
the test now asserts the fixture ids are real UUIDs before using them.

---

## 3. Audits by area

### Secrets — PASS

* Full git history scanned: no `.env`, `.pem`, `.key`, or private key ever
  committed. Only `.env.example`.
* No high-entropy assignments in any revision.
* Client bundle scanned for `JWT_SECRET`, `ANTHROPIC_API_KEY`,
  `SMTP_PASSWORD`, `sk-ant-`, `postgres://` — none present.
* No source maps in the production build.
* Only two `NEXT_PUBLIC_*` values exist, both non-secret by design: the API
  URL and the default tenant slug.
* Secrets are injected server-side; sealed-secrets documented in
  `deploy/k8s/platform/secrets/README.md`.

### Authentication — PASS

scrypt hashing, no plaintext, no reversible scheme. HS256 via `jose`, 15-minute
access tokens, `alg: none` rejected. Refresh tokens rotate on use and the old
one dies immediately (tested). Only hashes stored. Login throttling in Postgres
— 5 failures per account, 100 per IP, failures only, cleared on success;
shared across replicas since the in-memory version multiplied the ceiling by
pod count. Password reset tokens: 32 random bytes, hash-only storage, single
use enforced by `UPDATE … RETURNING`, one-hour expiry, and using one revokes
every refresh token. Email verification issued in the same transaction as the
account. Account enumeration blocked on both login and reset.

### Authorization — PASS

Every protected route resolves the user server-side, and every query runs
inside `withTenant`, which sets `app.tenant_id` for the transaction. Row-level
security with `FORCE ROW LEVEL SECURITY` means the table owner is subject to
the policies too. Ownership is checked in the query, not by reading then
comparing. Frontend permissions do not exist as a concept — there are no role
flags in the client.

### Encryption at rest — PASS (application layer), **NOT VERIFIED** (disk)

Free text is AES-256-GCM before it reaches Postgres, with the value bound to
its row. Disk-level encryption underneath is the storage layer's job and is
not configured here. The keys must be backed up separately from the database —
a backup you cannot decrypt is not a backup.

### Database — PASS

Every query is parameterised; no string-concatenated SQL anywhere. RLS on all
tenant-scoped tables with `USING` and `WITH CHECK`, covering SELECT, INSERT,
UPDATE and DELETE. `login_failures` is deliberately outside RLS and documented
as such: it is consulted before a tenant is resolved, and keying it per tenant
would let anyone name a second tenant to reset their own budget. It holds no
personal data beyond an address that already failed to log in.

### Input validation — PASS

Zod on every body, query and path parameter, server-side. Type, format,
length, range, enum and structure. Unknown keys are dropped rather than
passed through, which is what blocks mass assignment.

### XSS — PASS

No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no `Function()` in
the codebase. React escapes by default. CSP added as defence in depth.

### Rate limiting — PASS

Global 300/minute per IP plus per-route budgets on the coach, registration and
public triage, and a separate failure-counting lockout on login and reset.

### File upload — **NOT APPLICABLE**

The product accepts no file uploads. No multipart parser is registered. This
is a genuine absence, not an unaudited area.

### Webhooks — **NOT APPLICABLE**

No inbound webhooks exist.

### SSRF — **NOT APPLICABLE**

No user-controlled URL is fetched server-side. The only outbound calls are the
Anthropic API and the error reporter, both from fixed configuration.

### Path traversal — **NOT APPLICABLE**

No filesystem path is derived from user input. Migrations read a fixed
directory.

### Logging — PASS

Authorization, cookie and tenant headers redacted and removed. Bodies never
logged. Query strings stripped from logged URLs. Error reports pseudonymise
the user with a salted hash, carry no bodies, headers or query strings, and
use route templates. Metrics carry nothing about a person — asserted by tests
that put an id in a URL and check it does not appear in `/metrics`.

### Dependencies — PASS, with a caveat stated plainly

30 advisories in the workspace: 1 critical, 19 high, 10 moderate.
**Zero of them are in either serving path.** Verified rather than assumed: the
API's production tree contains none of the affected packages, and the web
container ships only Next's standalone output, which was checked and contains
no `sharp`, `postcss`, `tar`, `xmldom` or `image-size`. Every advisory is in
build tooling — Expo CLI and Next's build dependencies.

The CI gate blocks on high or critical advisories reaching the serving path
and does not block on build tooling, because failing a pipeline on a
transitive that never runs in production is how teams learn to pass `--force`.

### CSRF — **NOT APPLICABLE, by architecture**

Authentication is a bearer token in the `Authorization` header, held in
`localStorage`, never a cookie. There is no ambient credential for a
cross-site request to ride. This is a deliberate trade: it removes CSRF and
accepts that an XSS could read the token — which is why the CSP above matters
and why `localStorage` is never treated as an authorization decision.

### Transport — PASS in configuration, **NOT VERIFIED** in operation

Ingress terminates TLS with cert-manager, HSTS is set by both services,
Postgres `pg_hba` is `hostssl`-only with scram-sha-256, and the API connects
with `sslmode=require`. Not verified end to end because no cluster is running
these workloads yet — pods do not start in this environment.

### Admin — **NOT APPLICABLE (no admin surface)**

There is no admin panel and no admin API. `role` exists in the schema with
values member/admin/owner but no route grants elevated capability, so there is
no privilege boundary to escalate across today. **This is a risk to revisit
the moment an admin surface is added** — the audit log and re-authentication
primitives exist, but nothing enforces them for an admin that does not exist.

### Multi-tenancy — PASS

Tested: user → own tenant (allowed), user → other tenant (denied), self-signup
into a closed clinic tenant (denied), tenant reassignment via mass assignment
(denied). Enforced by the database, not by application code.

### Infrastructure — PASS in configuration, **NOT VERIFIED** in operation

Non-root containers, dropped capabilities, `RuntimeDefault` seccomp, default-
deny NetworkPolicies in both namespaces, PodDisruptionBudgets, CI running in a
namespace separated from the database. All manifests validated against a real
Kubernetes API server. Pods have never actually run.

---

## 4. Remaining risks

| ID | Risk | Severity | Status |
|---|---|---|---|
| R1 | No independent penetration test | HIGH | NOT VERIFIED |
| R2 | Safety triage never clinically reviewed | HIGH | NOT VERIFIED |
| ~~R3~~ | ~~No field-level encryption at rest~~ | — | CLOSED (F6) |
| R11 | Encryption keys must be backed up separately from the database | MEDIUM | Documented, operational |
| R12 | `triggers.label`, `check_ins.note`, `life_domains.note` still cleartext | LOW | Boundary stated in SELF_HOSTING.md |
| R4 | No DPIA, policy, terms, processor agreement | HIGH | NOT DONE |
| R5 | `script-src 'unsafe-inline'` on the web app | MEDIUM | ACCEPTED, needs nonces |
| R6 | No 2FA | MEDIUM | NOT DONE |
| R7 | Access token in `localStorage`, readable by any XSS | MEDIUM | ACCEPTED trade, mitigated by CSP |
| R8 | Runtime behaviour never observed — no pod has started | MEDIUM | NOT VERIFIED |
| R9 | No admin surface exists, so none is hardened | LOW | Revisit when one is added |
| R10 | Backups on the same cluster they protect | MEDIUM | Documented in SELF_HOSTING.md |

---

## 5. What "SECURITY READY" would require

1. An independent penetration test, findings closed.
2. Clinical review of the safety triage and crisis copy.
3. DPIA, privacy policy, terms, and a processor agreement covering the model
   provider, plus a documented position on EU MDR.
4. ~~Field-level encryption~~ — done, see F6.
5. One full deployment observed running, including a restore drill executed
   end to end and timed.

Items 1–3 are not engineering work and are what now stands between this and
SECURITY READY.

---

## 6. How to reproduce

```sh
# Unit and integration suite, including the attack regressions
DATABASE_URL=postgres://…/cleat_test JWT_SECRET=… NODE_ENV=test pnpm -r test

# Boot guards
NODE_ENV=production CORS_ORIGINS='*'    node apps/api/dist/server.js   # must refuse
NODE_ENV=production CORS_ORIGINS='https://…' node apps/api/dist/server.js  # must refuse: no SMTP

# Headers
curl -sD- -o /dev/null http://localhost:3000/ | grep -i 'content-security\|strict-transport'
curl -sD- -o /dev/null http://localhost:8080/v1/public/meta | grep -i 'content-security'
```

**378 tests green** across four packages at the time of writing: 257 core, 78
API against real PostgreSQL (89, including the at-rest encryption checks), 19
i18n, 13 web.
