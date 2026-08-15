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

### F18 — The product invented an assessment of people it had never observed · HIGH · FIXED

**Symptom.** On a brand new account, minutes old, with no check-ins and no
craving logs, the indicators screen reported **Self-trust 60** and **Risk 10**.
The other five indicators correctly showed nothing. The page is headed *"There
is no total score here… these are seven separate trends you can act on"* and
*"This is what your own data says."* Neither number came from any data.

**Root cause.** Two independent bugs producing the same class of lie.

*Self-trust* combined three parts. `vsBest` compared the current streak to
`longestMs` — but the longest streak *includes* the current one, so for anyone
who had never relapsed the ratio was a flat 1, contributing 50 points as a
constant dressed up as a measurement. `kept` fell back to a neutral 0.5 when no
craving had been resolved, adding 10 more. And the returned sample count was
`checkIns + decided + 1`, where the `+ 1` manufactured a data point that did not
exist, so the confidence never came out as `none` and the interface never
treated it as blank. 50 + 0 + 10 = the 60 on screen.

*Risk* scored 10 for "going quiet" — fewer check-ins than expected. That is a
real signal from somebody who was previously speaking. From an account created
seconds earlier it is not silence, it is arrival.

**Why this is filed here rather than as a UI defect.** This is the failure mode
the product exists to avoid. Somebody in early recovery is already carrying a
running self-assessment that is usually wrong and usually harsh. An app that
hands them a fabricated number — in either direction — is not neutral: 60/100
for self-trust is either hollow flattery or, to somebody who feels they have
none, an accusation that they are misjudging themselves. The honest output was
a blank, and a blank was available.

**Fix.** Three layers. Self-trust returns null until there is at least one
check-in or one resolved craving, and now compares against `previousBestMs` —
the best *completed* streak — so it credits nothing for a record nobody has
beaten. Risk's quiet signal waits three days before an absence of check-ins
means anything. And the assembly step enforces the invariant directly: no
sample, no value, no trend — checked once for every indicator rather than
trusted to each, because two of them broke it independently.

**Regression test.** Six cases in `score.test.ts`, including the exact day-zero
state measured on screen, and a structural check across four snapshots that no
indicator ever reports a value without a sample behind it.

**Found by.** Looking at the running product, screen by screen. Every test in
the suite passed throughout.

### F17 — The image could not be built behind a TLS-inspecting proxy · LOW · FIXED

**Symptom.** `docker build` died on `SELF_SIGNED_CERT_IN_CHAIN` during the
dependency install whenever outbound HTTPS passed through a middlebox
presenting its own certificate.

**Why it counts.** This product's whole premise is that an organisation can run
it on their own hardware. Corporate networks that terminate TLS are exactly the
environment that premise describes, and an image that cannot be built there is
an image that will be pulled from somebody else's registry instead — which is
the supply-chain outcome self-hosting exists to avoid.

**Fix.** Both Dockerfiles accept an optional CA as a build secret
(`--secret id=ca,src=…`). A secret rather than a `COPY`, so the certificate
never lands in a pushed layer, and entirely optional — without it the build is
byte-identical to before.

**The first fix was incomplete, and the way it failed is the point.** The CA was
mounted only on the dependency install. The API image also runs `pnpm deploy`,
which re-resolves the production tree and therefore reaches the registry too —
and that step did not fail. It *hung*, retrying a handshake it could not
complete, with no output for minutes. A build that stops with an error tells you
what is wrong; a build that hangs tells you nothing, and the natural conclusion
is that the machine is slow. Found by watching the build rather than by
believing the first green result.

**Verified.** Both images built through this environment's own proxy, which
reproduces the original failure exactly, and both were then run rather than only
built. Web: serves on 3000 as uid 10001 with the expected `connect-src 'self'`.
API: serves on 8090 as uid 10001, migrates on boot, reports `database: ok` at
`/readyz`, and returns an `emergency` triage with `bypassCoach: true`.

### F16 — A bad encryption key booted cleanly and broke every write · MEDIUM · FIXED

**Symptom.** The production configuration guard checks that
`FIELD_ENCRYPTION_KEYS` is *present*. Nothing checked that the keys *work*. The
keyring is built lazily on first use, so a truncated or mistyped key — measured:
29 bytes where 32 are required — let the process start, pass every probe, and
return 500 on the first attempt to save a craving note, a why statement or a
message to the coach. A healthy pod serving a product that cannot store
anything.

**Fix.** `assertKeyRingUsable()` in `server.ts`, before anything is served, so a
bad key fails the rollout instead of every write.

**Regression test.** Three cases in `crypto/field.test.ts`: a wrong-length key,
an active key id naming nothing, and a well-formed ring.

**Found by.** The end-to-end suite, on its first run against a fresh
configuration.

### F15 — Every failed save was silent · HIGH · FIXED

**Symptom.** Every mutation handler in the web app was written as
`try { … } finally { setBusy(false) }` with no `catch`. When the request failed
the promise rejected with nobody listening, the spinner stopped, and the screen
returned to exactly how it had looked. Nothing was saved and nothing said so.

**Why it matters here more than elsewhere.** Somebody typing out why they want
to stop, at two in the morning, does not get a second run at that paragraph.
Being quietly ignored by the thing you reached for is its own small injury.

**Root cause.** Not a typo — a pattern, repeated in every page, that looks
careful. `finally` without `catch` restores the interface and discards the
error.

**Fix.** `lib/action.ts`: one place that runs a write, reports its own failures
and distinguishes "try again in a moment" from "this will not work". Input is
now cleared only after a write lands, so a failed save no longer takes the text
with it.

**Regression test.** An end-to-end test that aborts the request in the browser
and asserts both that an error appears and that what was typed is still on
screen.

**Found by.** Adding ESLint. `@typescript-eslint/no-floating-promises` and
`no-misused-promises` flagged twenty call sites; the pattern behind them was the
defect.

### F14 — Two replicas migrating at once crashed one of them · HIGH · FIXED

**Symptom.** The API runs `migrate()` at boot and the Deployment runs
`replicas: 2`. On a first rollout both pods start against an empty database,
both read an empty `schema_migrations`, and both apply `001_init.sql`. Measured
with three concurrent runners: one succeeded, two died on `duplicate key value
violates unique constraint "pg_type_typname_nsp_index"` — Postgres's own
catalogue refusing the second `CREATE TYPE`. In a cluster that is one pod
serving and one in CrashLoopBackOff, on the first deploy of every new install.

**Why the existing mitigation did not apply.** There *is* a migration Job, and
the README described it as running first. It carries ArgoCD and Helm pre-sync
hook annotations, which order it only under those tools. The documented deploy
command is `kubectl apply -k`, where the annotations are inert.

**Fix.** A Postgres session-level advisory lock around the whole run, so the
ordering is safe whichever tool applies the manifests. The applied list is read
after the lock is taken, not before.

**Regression test.** `db/migrate.test.ts` — five cases against a throwaway
database: fresh install, second run is a no-op, three concurrent runners, an
upgrade from an earlier release with real rows that must survive, and every
tenant-scoped table still carrying `FORCE ROW LEVEL SECURITY`.

### F13 — The readiness probe named the host it could not reach · LOW · FIXED

**Symptom.** `/readyz` returned the driver's error verbatim —
`"connect ECONNREFUSED 127.0.0.1:5432"` — on an endpoint that takes no
credentials.

**Fix.** The reason goes to the log, where an operator has it; the response says
only that we are not ready, which is all a probe needs.

**Also fixed alongside it.** An unreachable database produced a 500. A 500 tells
a client the request will never work; a 503 tells it to come back. On a phone
with two bars that is the difference between an app that recovers by itself and
one that has to be force-quit. Connection-level driver codes now produce 503
with `Retry-After`; a constraint violation or a syntax error stays a 500, so a
real defect is not reclassified as weather.

**Regression test.** `resilience.test.ts`, six cases with every database call
failing — including that the crisis resources and the triage still answer, which
is the most important resilience property in the product and had no test at all.

### F11 — The hardening broke the product, and nothing in the suite could see it · HIGH · FIXED

**Symptom.** In the shipped Kubernetes configuration the browser refused every
single API call. Nobody could register, log in, or reach anything behind a
login — including the craving and crisis flows, which is the one failure this
product must not have.

**Root cause.** The Content-Security-Policy added during this hardening pass
built its `connect-src` from `process.env.NEXT_PUBLIC_API_URL` in
`next.config.mjs`. That file is evaluated by the **running server**, while the
client bundle inlines the same variable at **build time**.
`deploy/k8s/base/web.yaml` set no such variable on the container, so the header
collapsed to `connect-src 'self'` while the bundle called an absolute
cross-origin URL. The comment above the policy asserted it was "limited to this
origin and the API". It was not.

**Why nothing caught it.** There is no server-side symptom whatsoever. The pod
is healthy, the readiness probe on `/login` returns 200, no request reaches the
API, and nothing is logged anywhere — the refusal happens inside the browser.
The unit suite passed, the API integration suite passed, the manifests were
valid, and a rollout would have reported success. It was found by driving a
real browser through a real signup, and only after killing a stale `next start`
process that had been serving an older build and masking it. Reading the diff
would not have found it either: both halves are individually correct, and the
defect lives only in the relationship between them.

**Fix.** The coupling was removed rather than the value corrected. The API is
now served from `/v1` on the app's own origin via the Ingress, so `connect-src
'self'` is simply *true* instead of a value somebody has to keep in step. The
client's API base defaults to the empty string, meaning same origin, so one
built image serves any hostname — which self-hosting needed regardless, since
the previous default baked an absolute URL into every image. The policy moved
to `apps/web/csp.mjs`, shared by `next.config.mjs` and by the tests, and it now
throws on an unparseable `NEXT_PUBLIC_API_URL` instead of silently narrowing to
`'self'`.

**Regression test.** `apps/web/src/lib/csp.test.ts` — thirteen assertions
pinning the header to the code that has to live under it, including
*"refuses a cross-origin API that was not configured — the shipped bug"*, which
holds the exact broken combination in place so the pairing cannot be quietly
loosened again.

**Verified.** Both shapes driven end to end in Chromium against a live API and
Postgres: cross-origin (`connect-src 'self' http://localhost:8080`) and the
production same-origin shape behind a proxy standing in for the Ingress
(`connect-src 'self'`). Registration, plan creation and the dashboard all
succeed with zero console errors.

**What this says about the rest of this report.** Every "verified" row here was
verified against the layer it names. This defect sat *between* two layers that
were each correct on their own, and it was the most severe one in the codebase.
Findings of that shape are the argument for blocker B1: an independent test by
someone who did not build it.

### F10 — No second factor · MEDIUM · FIXED

**Attack.** Account takeover with a password alone. An account here is not a
shopping history: whoever holds it can read a relapse log and a coach
transcript, which is the raw material for blackmail, a custody dispute, or an
employer who was never meant to know. Password plus email recovery is thin
protection for that, and email is exactly what a controlling partner with the
household account already has.

**Fix.** TOTP (RFC 6238), optional rather than mandatory — forcing an
authenticator app on somebody in early recovery would push people away from a
tool they need. Enrolment is two steps so a failed QR scan cannot lock anyone
out. Ten single-use recovery codes, hash-only, because a lost phone must not
mean a lost account: that outcome is worse than the one 2FA prevents.

The details that decide whether it is real:

* The secret is encrypted with the field keyring before it is stored. A TOTP
  secret sitting in the clear next to a password hash is a second factor in
  name only once a backup leaks.
* A correct password produces a five-minute challenge, not tokens. The
  challenge is stored rather than signed so it can be consumed exactly once.
* **Five attempts per challenge.** Six digits is a million possibilities,
  which sounds like a lot and is not — unlimited guessing inside a
  five-minute window is a few thousand requests a second away from certain.
* Disabling requires the password, so an attacker holding a borrowed session
  cannot simply take the second factor off.

**Regression test.** Eight unit tests including the RFC 6238 published vectors
— a home-grown TOTP that is self-consistent and wrong locks people out of
their own accounts, so agreeing with a real authenticator is the property
under test. Seven integration tests: two-step enrolment, the secret being
ciphertext at rest, password-alone no longer logging in, completion, challenge
replay, the five-attempt ceiling refusing even a correct code afterwards,
single-use recovery codes, and disable requiring the password.

**Correction — this was reported FIXED before it was usable.** Every claim
above was true of the server and none of it reached a user. There was no
interface to switch two-factor on, in either the web app or the mobile app, so
no account could have it; and the login screens read the response as if tokens
were always present, so an account that *did* have it — enabled by calling the
API directly — could not sign in afterwards. The client stored `undefined` as
its access token and left the person on a screen that looked signed in and was
not. A control nobody can turn on is not a control, and one that locks people
out is worse than none. See F12.

### F12 — Two-factor was unreachable, and would have locked people out · HIGH · FIXED

**Symptom.** Two separate failures of the same feature. Nobody could enable
2FA: no UI existed anywhere in either client. And had they enabled it out of
band, they could never sign in again — `signIn` assumed an `AuthResponse` and
wrote `response.accessToken` straight into storage, but a challenged login
returns `{ mfaRequired, challenge }` and no tokens.

**Root cause.** The server-side work was verified server-side, and stopped
there. Both API halves were correct and fully tested; the clients had never
been taught the challenge exists. F11 was the same shape — a defect in the gap
between two layers that were each individually right — found the same way, one
task earlier.

**Fix.** `signIn` now returns a discriminated outcome rather than assuming a
session, so a challenge cannot be mistaken for tokens. Both login screens ask
for the code. A `TwoFactor` component in settings does enrolment, shows the
recovery codes once with a download, and disables with a password.

**A third defect, found by the test rather than by reading.** Driving the flow
end to end showed a single mistyped digit throwing the person back to re-enter
their password. Every verify failure returned the same opaque 401, so the
client could not tell "four tries left" from "this challenge is finished" and
had to assume the worst — which made the five attempts the server grants
unreachable in practice. The endpoint now distinguishes `totp_invalid_code`
from `totp_challenge_expired`. That leaks nothing: whoever is asking already
holds the challenge and would learn the same by trying again, and the ceiling,
the five-minute expiry and single-use consumption are what bound the guessing.
Spending the last attempt now consumes the challenge immediately rather than on
the next request, so nobody types into something that can no longer succeed.

**Regression test.** Two new integration tests — the attempt ceiling now
asserting the response codes, and one proving a challenge survives a wrong code
while a challenge that never existed does not.

**Verified.** The whole lifecycle driven in Chromium against a live API,
Postgres and the production same-origin configuration, with TOTP codes
generated by an independent RFC 6238 implementation rather than the server's
own: enrol, reject a wrong code without enabling, receive ten recovery codes,
sign out, be challenged instead of stranded, survive a wrong code, sign in with
a real code, sign in with a recovery code, and be refused when replaying that
same recovery code.

### F7 — A stolen refresh token kept working · HIGH · FIXED

**Attack.** Rotation was in place, so a stolen refresh token worked once and
the legitimate client's next refresh failed. The comment in the code said that
this "reveals that the theft happened" — but nothing acted on the revelation.
In practice the victim saw a logout, signed in again, and the thief kept a
live session nobody had ended.

**Root cause.** Rotation without reuse detection. Detecting the replay and
doing nothing with it is the gap.

**Fix.** Replaying a consumed refresh token now revokes every refresh token
for that account and bumps its session generation, ending the thief's access
and the victim's at the same moment. Written to the audit log as
`auth.refresh_token_reuse_detected`. Losing a session is an inconvenience;
leaving the thief with one is not.

**Regression test.** "a replayed refresh token ends every session for that
account" — asserts the replay fails, the victim's rotated refresh token fails,
and the victim's access token fails.

**Worth recording:** this broke an existing test, correctly. "Rotates the
refresh token on use" performs exactly this replay, and the new consequence
took the shared fixture down with it. The test now uses its own account.

### F8 — Signing out left the access token alive · MEDIUM · FIXED

**Attack.** Logout revoked refresh tokens and nothing else, so the bearer kept
working for its full fifteen minutes. On a shared machine that is fifteen
minutes of somebody's recovery record after they believed they had left. A
completed password reset had the same hole, and there it is worse: the reason
people reset a password is usually that they think somebody else is in the
account.

**Root cause.** A stateless JWT cannot be recalled, and nothing stood in for
recall.

**Fix.** A `token_version` column on the user, carried as a claim and checked
on every authenticated request. Logout, password reset and reuse detection
bump it, which invalidates every token issued before the bump — immediately,
with no denylist to keep or expire. Tokens minted before the claim existed
verify as generation 0, so deploying this does not sign everybody out.

**Regression test.** "signing out invalidates the access token, not only the
refresh token" and "a completed password reset ends existing sessions".

### F9 — Login timing disclosed whether an account existed · LOW · FIXED

**Attack.** Measured over twelve requests, a login naming a real account took
57ms longer than one naming an unknown address — an account oracle for anyone
with a stopwatch, and the same question the forgot-password endpoint was
carefully built to refuse.

**Root cause.** The unknown-account path verified against the placeholder
string `scrypt$AAAA$AAAA`, which is not a valid hash, so parsing failed and
the function returned before doing any scrypt work.

**Fix.** A real scrypt hash of a random value, computed once at module load.
The unknown-account path now does the same work as the real one. Measured
after: 0.8ms.

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

**`script-src 'unsafe-inline'` stays, and that is now a measured decision
rather than an unfinished one.**

Nonces were implemented and tested: middleware issuing a per-request nonce
with `'strict-dynamic'`, scoped by matcher to the routes that render user
content so `/` and `/kris` would keep static rendering. Under it the
application was completely dead — zero scripts carried the nonce, every chunk
was refused, and the login page did nothing at all. Next only stamps nonces
when a page renders dynamically, and every page here is a statically
prerendered client component; `export const dynamic = 'force-dynamic'` does
not change that for a client component with no server data dependency, which
was also tested.

Making it work means restructuring twelve pages away from static rendering.
What it would close is an XSS, and this codebase has no
`dangerouslySetInnerHTML`, no `innerHTML`, no `eval` and no `Function()` —
React escapes everything. Against a compromised dependency `'strict-dynamic'`
would not help either: a poisoned chunk is loaded by the nonced bootstrap and
inherits its trust.

High cost, thin benefit, and the record says it was tried rather than skipped.
The directive that matters most — `default-src 'self'` with a bounded
`connect-src`, which stops an injected script sending anything off-origin — is
in place.

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

**15 of 15 blocked** in the first probe, and **10 of 10** in a second pass
covering session handling, tenant header manipulation, email collision,
parameter pollution, prototype pollution, login timing and coach throttling
(`scripts/pentest-sessions.mjs`). The IDOR result is worth one caution: it returns 404
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
| ~~R12~~ | ~~Three narrative columns still cleartext~~ | — | CLOSED; every free-text column is now encrypted |
| R4 | No DPIA, policy, terms, processor agreement | HIGH | NOT DONE |
| R5 | `script-src 'unsafe-inline'` on the web app | LOW | ACCEPTED with evidence — nonces implemented, measured to break the app, reverted. See F3. |
| ~~R6~~ | ~~No 2FA~~ | — | CLOSED (F10) |
| R13 | Access tokens live 15 minutes; revocation is immediate but relies on a database read per request | LOW | Accepted, measured |
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
# Lint. Type-aware rules; this is what found the silent-save defect (F15).
pnpm exec eslint .

# Unit and integration suite, including the attack regressions, the migration
# concurrency check, the resilience suite and the OpenAPI contract test.
DATABASE_URL=postgres://…/cleat_test JWT_SECRET=… \
  FIELD_ENCRYPTION_KEYS='k:<32 bytes base64>' pnpm -r test

# The browser journeys, against a real API and database in the production
# same-origin shape. This is the stage that catches defects living between two
# layers that are each individually correct — F11, F12, F15.
DATABASE_URL=postgres://…/cleat_test bash scripts/e2e.sh

# Boot guards
NODE_ENV=production CORS_ORIGINS='*'    node apps/api/dist/server.js   # must refuse
NODE_ENV=production CORS_ORIGINS='https://…' node apps/api/dist/server.js  # must refuse: no SMTP
FIELD_ENCRYPTION_KEYS='k:c2hvcnQ=' node apps/api/dist/server.js        # must refuse: bad key

# Headers
curl -sD- -o /dev/null http://localhost:3000/ | grep -i 'content-security\|strict-transport'
curl -sD- -o /dev/null http://localhost:8080/v1/public/meta | grep -i 'content-security'

# Manifests, against a real API server rather than a YAML parser.
#
# The namespace has to exist for real first. A dry-run never creates anything,
# so without this every namespaced resource fails with `namespaces "cleat" not
# found` — fourteen errors that look alarming and mean nothing. A genuine
# `kubectl apply -k` does not have the problem, because kubectl orders the
# Namespace ahead of the objects inside it.
kubectl create namespace cleat --dry-run=client -o yaml | kubectl apply -f -
kustomize build deploy/k8s/overlays/prod | kubectl apply --server-side --dry-run=server -f -
```

**446 unit and integration tests plus 8 browser journeys green** at the time of
writing: 266 core, 131 API against real PostgreSQL (including at-rest
encryption, two-factor, migration concurrency, resilience with the database
down, and the OpenAPI contract), 19 i18n, 30 web, and 8 end-to-end.

Verified in this environment beyond the suites: both container images build and
the web image runs as uid 10001 serving the expected policy; both Kubernetes
overlays pass a server-side dry-run against a real API server.
