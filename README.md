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

`MASTERPROMPT.md` is the full specification. `BRAND.md` covers naming,
positioning and visual identity.

---

## What it does

| Area | What is built |
|---|---|
| **Craving engine** | The "I'm craving" button: safety question → feeling → place → intensity → a concrete plan. Ten-minute protocol, urge surfing, who to call first, and the person's own *why* on screen. |
| **Safety triage** | Deterministic, runs before anything else. An emergency never reaches the language model — the app answers with fixed wording and local emergency numbers instead. |
| **Substance-aware risk** | Alcohol, benzodiazepines and other sedatives can have life-threatening withdrawal. For those, the app leads with "talk to a clinician before you stop", not with encouragement. |
| **Negotiation detector** | Names the argument — *"bara en gång"*, *"jag har varit duktig"*, *"jag börjar på måndag"* — then asks whether you want to examine it or act on it. Never mocks. |
| **Relapse ("I messed up")** | Safety questions first, then a ten-step autopsy that produces a new protection plan. No lost-progress language anywhere. |
| **Recovery indicators** | Seven separate trends — stability, craving control, routine, connection, purpose, self-trust, risk. Deliberately **no** composite score. |
| **Personal recovery graph** | Finds patterns in your own data ("after bad nights your cravings run 2.4 points stronger, based on 6 occasions") and shows the evidence count behind every claim. |
| **Money and time reclaimed** | Framed as reclamation, not savings. |
| **Daily check-ins** | Morning and evening, feeding the indicators and the pattern engine. |
| **AI coach** | Claude with the Cleat system prompt, motivational-interviewing language, and coach memory. Falls back to a fully functional local coach when the model is unavailable. |
| **Privacy** | Export everything, delete everything. First-class controls, not a support ticket. |

Both Swedish and English are shipped from day one; the Swedish catalog is the
source of truth and the English one is type-checked against it.

---

## Architecture

```
packages/core      Pure domain engine. No I/O, no clock reads it did not receive.
                   Safety triage, phases, craving plans, streaks, indicators,
                   insights, rebuild domains, reclaimed money and time. 119 tests.
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

### Without an API key

`ANTHROPIC_API_KEY` is optional. Without it the API serves a **deterministic
local coach**: the ten-minute protocol, the craving plan, the negotiation
counters and the relapse flow all work, because none of them need a language
model. The same fallback catches model refusals, rate limits and outages — the
response tells the client which source answered.

---

## Tests

```bash
pnpm -r test        # 186 tests
pnpm -r typecheck
```

The API suite runs against a **real** PostgreSQL, including a test that asserts
one tenant cannot see another's data and that an `X-Tenant` header cannot move an
authenticated session sideways into another organisation. A mocked repository
would happily prove an isolation the database does not actually enforce.

---

## Deploying

```bash
kubectl apply -k deploy/k8s/overlays/dev    # bundled Postgres, 1 replica
kubectl apply -k deploy/k8s/overlays/prod   # managed database, 3 replicas
```

The manifests include a pre-sync migration Job (so replicas do not race to
migrate), readiness probes that actually touch the database, a default-deny
NetworkPolicy, PodDisruptionBudgets, an HPA, and the restricted Pod Security
Standard enforced at the namespace.

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
