# Cleat

**Rebuild your life.**

```
No religion.
No shame.
No judgment.
No bullshit.
Just recovery.
```

Cleat is a secular recovery platform. It is not a sobriety counter with a chat
bot bolted on: the central question is not *"have you stayed clean?"* but *"what
is happening in your life that makes you want to use?"* — and then helping change
the system around the behaviour.

This repository contains the whole product: a multi-tenant API, a web client, a
mobile client, and the Kubernetes manifests to run it.

> **The name is not cleared.** "Cleat" is a working name. Several unrelated
> companies already use it, and a proper trademark clearance has not been done.
> Read `BRAND.md` before spending money on it.

---

## The five modes

| Mode | Sub-brand | What it is |
|---|---|---|
| **I'M CRAVING** | Cleat Reset | The acute craving engine. Safety question, feeling, place, intensity, a plan. Contains Relapse Autopsy. |
| **I'M STRUGGLING** | Cleat Now | Losing your footing but not in an acute craving. The coach, immediately. |
| **MY RECOVERY** | Cleat Path | Plan, phase, why statement, future self, milestones, check-ins. |
| **MY PATTERNS** | Cleat Patterns | Triggers, behaviours, recurring patterns, seven indicators. |
| **REBUILD MY LIFE** | Cleat Rebuild | Sleep, health, home, money, work, exercise, social, relationships, identity, purpose. |

Alongside the five, one surface that is not for the person using at all:

| | | |
|---|---|---|
| **FOR THE PERSON STANDING NEXT TO IT** | Cleat Nära | For a relative. What is actually happening, what helps, what does not, sentences that can be said out loud, a self-check about where *they* have got to, and somewhere to think out loud. Reachable with no account. Connected to nobody's data — see below. |

`MASTERPROMPT.md` is the full specification. `BRAND.md` covers naming,
positioning and visual identity.

---

## What it does

| Area | What is built |
|---|---|
| **Craving engine** | The "I'm craving" button: safety question → feeling → place → intensity → a concrete plan. Ten-minute protocol, urge surfing, who to call first, and the person's own *why* on screen. |
| **Safety triage** | Deterministic, runs before anything else. An emergency never reaches the language model — the app answers with fixed wording and local emergency numbers instead, and does so with no network at all: the numbers are compiled into both clients, and the crisis page works signed out, offline and with JavaScript disabled. |
| **Substance-aware risk** | Alcohol, benzodiazepines and other sedatives can have life-threatening withdrawal. For those, the app leads with "talk to a clinician before you stop", not with encouragement. |
| **Negotiation detector** | Names the argument — *"bara en gång"*, *"jag har varit duktig"*, *"jag börjar på måndag"* — then asks whether you want to examine it or act on it. Never mocks. |
| **Relapse ("I messed up")** | Safety questions first, then a ten-step autopsy that produces a new protection plan. No lost-progress language anywhere. |
| **Recovery indicators** | Seven separate trends — stability, craving control, routine, connection, purpose, self-trust, risk. Deliberately **no** composite score. |
| **Personal recovery graph** | Finds patterns in your own data ("after bad nights your cravings run 2.4 points stronger, based on 6 occasions") and shows the evidence count behind every claim. |
| **Money and time reclaimed** | Framed as reclamation, not savings. |
| **Daily check-ins** | Morning and evening, feeding the indicators and the pattern engine. |
| **AI coach** | Claude with the Cleat system prompt, motivational-interviewing language, and coach memory. Falls back to a fully functional local coach when the model is unavailable. |
| **Privacy** | Export everything, delete everything. First-class controls, not a support ticket, and present in both clients. |
| **Cleat Nära** | A tool for the relative, not a window into the patient. It shows nothing about any particular person, by design: somebody who can watch another person's streak counter has been handed a surveillance tool, and in these households surveillance is usually already part of the problem. The self-check computes in the browser and is posted nowhere; the sounding board runs on its own system prompt that is forbidden to tell anybody to stay or leave, to assign blame, or to promise that the other person will recover. |
| **Account recovery** | Forgotten password, reset link, email confirmation, and an optional second factor with recovery codes. Losing an account here means losing the record of the hardest thing somebody has done, so the way back in is treated as a feature rather than a support address. |

Both Swedish and English are shipped from day one; the Swedish catalog is the
source of truth and the English one is type-checked against it.

---

## Architecture

```
packages/core      Pure domain engine. No I/O, no clock reads it did not receive.
                   Safety triage, phases, craving plans, streaks, indicators,
                   insights, rebuild domains, reclaimed money and time, and the
                   supporter surface. 277 tests.
packages/i18n      Swedish + English catalogs, type-checked for completeness.

apps/api           Fastify + PostgreSQL. Multi-tenant via row-level security.
apps/web           Next.js 15 client.
apps/mobile        Expo / React Native client.

deploy/            Dockerfiles, docker compose, Kustomize base + overlays.
```

The domain logic lives in `packages/core` and is shared by all three surfaces, so
the phone and the browser cannot disagree about what day someone is on.

### Multi-tenancy

One deployment serves two shapes of customer through the same mechanism:
individuals who sign up on their own (all in one shared `public` tenant) and
organisations — clinics, employers, programmes — who get their own tenant,
addressed by subdomain.

Isolation is enforced by **PostgreSQL row-level security**, not by application
code. Every request runs inside a transaction that sets `app.tenant_id`; every
tenant-scoped table has a policy that compares it to the row's `tenant_id`.
Without that setting, `current_setting` returns NULL, the predicate is NULL, and
the query returns nothing.

That default matters here more than in most products. Recovery data crossing a
tenant boundary is not a bug report — it is the disclosure of someone's addiction
history to their employer or their clinic. A forgotten `WHERE tenant_id =` should
return zero rows, not somebody else's.

The tables also use `FORCE ROW LEVEL SECURITY`, so the isolation holds even when
the application connects as the table owner.

### The safety layer

```
message ──► deterministic triage ──► emergency? ──► fixed response + local numbers
                                        │              (the model is never called)
                                        └── no ──► state → phase → need → coach
```

The triage is pattern-based, biased toward false positives, and runs on every
message including the ones about to be sent to the model. Offering emergency
information to someone who did not need it costs them ten seconds; missing it
costs more.

---

## Running it locally

Requires Node 22, pnpm 10 and PostgreSQL 16.

```bash
pnpm install
pnpm --filter @cleat/core build
pnpm --filter @cleat/i18n build

createdb cleat   # or use deploy/docker-compose.yml
cp .env.example .env  # then set DATABASE_URL and JWT_SECRET

pnpm --filter @cleat/api migrate
pnpm --filter @cleat/api seed     # demo account with two weeks of history

pnpm dev:api    # http://localhost:8080
pnpm dev:web    # http://localhost:3000
pnpm dev:mobile # Expo
```

Seeded accounts:

| Tenant | Email | Password |
|---|---|---|
| `public` (consumer) | `demo@cleat.app` | `demo-password-123` |
| `demo-clinic` (organisation) | `patient@demo-clinic.se` | `demo-password-123` |

Or the whole stack in containers:

```bash
docker compose -f deploy/docker-compose.yml up --build
```

That stack is for evaluating and developing against, not for serving real
people: it runs with `NODE_ENV=development` because the API refuses to boot in
production without a mail server, and mail therefore goes to the log instead of
to an inbox — so a password reset would go nowhere. Encryption at rest is on,
with a committed key that is worth nothing as a secret and exists so the local
stack behaves like the real one. `DEPLOYMENT.md` and `deploy/k8s` are the real
thing.

Behind a TLS-inspecting proxy, point `CLEAT_BUILD_CA` at your CA so the
dependency install inside the images trusts it.

### Without an API key

`ANTHROPIC_API_KEY` is optional. Without it the API serves a **deterministic
local coach**: the ten-minute protocol, the craving plan, the negotiation
counters and the relapse flow all work, because none of them need a language
model. The same fallback catches model refusals, rate limits and outages — the
response tells the client which source answered.

---

## Tests

```bash
pnpm exec eslint .   # type-aware rules; see eslint.config.mjs for what is on and why
pnpm -r typecheck

# The API suite talks to a real database and, deliberately, to real encryption:
# without the key the at-rest tests pass by finding nothing to look at, which is
# the exact failure they exist to catch. So the command that runs them is the
# command with the key in it. The value below is a throwaway for local use.
export DATABASE_URL=postgres://cleat:cleat@localhost:5432/cleat
export JWT_SECRET=a-local-secret-that-is-long-enough-for-hs256
export FIELD_ENCRYPTION_KEYS='dev:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
export FIELD_ENCRYPTION_ACTIVE_KEY=dev

pnpm -r test         # 479 unit and integration tests

pnpm --filter @cleat/web exec playwright install --with-deps chromium
bash scripts/e2e.sh  # 17 browser journeys, same environment
```

The database role must **not** be a superuser: superusers bypass row-level
security, so the isolation tests would pass against a database that enforces
nothing.

The API suite runs against a **real** PostgreSQL, including a test that asserts
one tenant cannot see another's data and that an `X-Tenant` header cannot move an
authenticated session sideways into another organisation. A mocked repository
would happily prove an isolation the database does not actually enforce.

`scripts/e2e.sh` drives a real browser against a real API and database, in the
shape production runs: one origin, `/v1` proxied to the API. It exists because
the two worst defects this codebase has shipped — a Content-Security-Policy that
blocked every API call in the deployed configuration, and a two-factor feature
with no interface — were invisible to every other test. In both cases each layer
was individually correct and the defect lived in the gap between them.

---

## Deploying

```bash
kubectl apply -k deploy/k8s/overlays/dev    # bundled Postgres, 1 replica
kubectl apply -k deploy/k8s/overlays/prod   # managed database, 3 replicas
```

The manifests include a migration Job, readiness probes that actually touch the
database, a default-deny NetworkPolicy, PodDisruptionBudgets, an HPA, and the
restricted Pod Security Standard enforced at the namespace.

A note on that Job, because the obvious reading is wrong: it carries ArgoCD and
Helm pre-sync hook annotations, so it runs before the Deployment **only under
those tools**. With the plain `kubectl apply -k` above, the annotations are
inert and the Job and the Deployment go out together — two API replicas then
start migrating the same empty database at once. Measured, before it was fixed:
of three concurrent runners, one succeeded and two died on a Postgres catalogue
conflict, which in a cluster is one pod serving and one in CrashLoopBackOff on
the first deploy. The migration runner now takes a Postgres advisory lock, so
the ordering is safe whichever tool applies it.

Create the secret out of band:

```bash
kubectl -n cleat create secret generic cleat-secrets \
  --from-literal=DATABASE_URL='postgres://…' \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-…'
```

See `DEPLOYMENT.md` for the full runbook.

---

## Design rules encoded in the code

These are product decisions, written down where they cannot quietly erode:

- **No composite recovery score.** `computeIndicators` returns seven trends and
  nothing else, and there is a test asserting the result has no `overall` field.
  A single percentage turns a life into a scoreboard and tells someone on a bad
  day that they are failing at being a person.
- **A relapse never erases anything.** `computeStreak` restarts the current
  streak but keeps `longestDays` and `totalDaysInRecovery`, and the relapse
  endpoint returns all three so no screen can imply progress was lost.
- **The acute state gets a short horizon.** In `day_zero` and `acute` the app
  will not show five-year goals; `shouldShowLongHorizon` enforces it.
- **High-intensity cravings get low-effort tools only.** Someone at 9/10 cannot
  run a decisional-balance exercise, and offering one is a way of losing them.
- **No religion, no shame.** Enforced by tests over both language catalogs.

---

## Safety

Cleat is a coach, not care. It does not replace a doctor, psychiatry,
addiction treatment or emergency services. The application says so on the login
screen, in the coach, and in settings.

If you are in danger right now, contact your local emergency number.
In Sweden: **112**. Mind Självmordslinjen: **90101**.

---

## Licence

MIT — see `LICENSE`.
