# Deploying Cold Turkey

## What you need

- A Kubernetes cluster (1.27+) with an ingress controller and cert-manager
- A PostgreSQL 16 database — managed, with backups and point-in-time recovery
- A container registry
- Optionally, an Anthropic API key

The application runs without an API key. Without one the coach falls back to the
deterministic local implementation, which covers the ten-minute protocol, the
craving plan, the negotiation counters and the relapse flow. Nothing that matters
at 2am depends on the network reaching a model.

---

## 1. Build and push images

```bash
export REGISTRY=ghcr.io/wolfoftyreso-debug
export TAG=$(git rev-parse --short HEAD)

docker build -f apps/api/Dockerfile -t $REGISTRY/coldturkey-api:$TAG .
docker push $REGISTRY/coldturkey-api:$TAG

# NEXT_PUBLIC_* values are inlined at build time — the API URL is baked into
# the image and cannot be changed later with an environment variable. Build one
# image per environment.
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.coldturkey.example \
  --build-arg NEXT_PUBLIC_DEFAULT_TENANT=public \
  -t $REGISTRY/coldturkey-web:$TAG .
docker push $REGISTRY/coldturkey-web:$TAG
```

Pin the tags in the overlay rather than deploying `latest`:

```bash
cd deploy/k8s/overlays/prod
kustomize edit set image \
  ghcr.io/wolfoftyreso-debug/coldturkey-api=$REGISTRY/coldturkey-api:$TAG \
  ghcr.io/wolfoftyreso-debug/coldturkey-web=$REGISTRY/coldturkey-web:$TAG
```

## 2. Create the secret

Never commit it. The placeholder in `base/config.yaml` exists only so
`kustomize build` produces a complete manifest.

```bash
kubectl create namespace coldturkey

kubectl -n coldturkey create secret generic coldturkey-secrets \
  --from-literal=DATABASE_URL='postgres://user:pass@db.internal:5432/coldturkey?sslmode=require' \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-…'
```

`JWT_SECRET` must be at least 32 characters; the API refuses to start otherwise.
Rotating it signs every user out — access tokens stop verifying and refresh
tokens are rejected on their next use.

## 3. Configure

Edit `deploy/k8s/base/config.yaml` (or patch it in your overlay):

| Key | Notes |
|---|---|
| `CORS_ORIGINS` | Comma-separated. Do not leave `*` in production. |
| `DEFAULT_TENANT_SLUG` | The shared consumer tenant. Default `public`. |
| `ALLOW_PUBLIC_SIGNUP` | Set `false` for a deployment that only serves organisations. |
| `ACCESS_TOKEN_TTL` | Default `15m`. |
| `REFRESH_TOKEN_TTL_DAYS` | Default `30`. Rotated on every use. |
| `COACH_MODEL` | Default `claude-opus-5`. |
| `DATABASE_POOL_MAX` | Per pod. Multiply by replica count and compare with the database's connection limit. |

## 4. Apply

```bash
kubectl apply -k deploy/k8s/overlays/prod
kubectl -n coldturkey rollout status deploy/coldturkey-api
```

Order of operations:

1. The `coldturkey-migrate` Job runs first (annotated as an Argo CD `PreSync` and
   a Helm `pre-install`/`pre-upgrade` hook). Migrations are forward-only and
   idempotent — `schema_migrations` records what has run.
2. Pods start. The API also calls `migrate()` at boot, which is a no-op behind
   the Job. That belt-and-braces exists so a single-container deployment stays
   correct.
3. `readinessProbe` hits `/readyz`, which queries the database. A pod that cannot
   reach Postgres is kept out of the Service rather than serving errors.

## 5. Verify

```bash
kubectl -n coldturkey run curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -s http://coldturkey-api/readyz
# {"status":"ready","database":"ok","coach":"configured"}
```

`coach: "local"` means no API key is configured — the app is working, just
answering from the built-in coach.

---

## Adding an organisation tenant

Organisations do not self-register. Create the tenant, then the first user:

```sql
INSERT INTO tenants (slug, name, settings)
VALUES ('vardcentralen', 'Vårdcentralen Nord', '{"publicSignup": false}');
```

Then create the owner account through the API with the `X-Tenant: vardcentralen`
header, from a session that is allowed to do so, or directly with the seed
helper. Their users reach the app at `vardcentralen.coldturkey.example`.

After login the tenant always comes from the signed token, so a client cannot
change a header to reach another organisation's data. There is a test asserting
exactly that.

---

## Operations

**Metrics.** `/metrics` exposes Prometheus text format: request and error
counters, coach model calls versus local fallbacks, and emergency-path hits. None
of it contains personal data. The pods carry `prometheus.io/scrape` annotations.

**Logs.** Request bodies are never logged, and `authorization`, `cookie` and
`x-tenant` headers are removed by the logger's redaction config. Keep it that
way: a recovery transcript in a log aggregator is a disclosure.

**Backups.** The whole product is in Postgres. Back it up, test the restore, and
encrypt at rest. Everything cascades from `users`, which is what makes account
deletion complete.

**Scaling.** The API is stateless; the HPA scales on CPU from 2 to 10 replicas.
Watch `DATABASE_POOL_MAX × replicas` against the database's connection limit
before raising `maxReplicas`.

**Zero-downtime deploys.** `maxUnavailable: 0`, PodDisruptionBudgets with
`minAvailable: 1`, and explicit SIGTERM/SIGINT handlers in the server so
in-flight requests drain inside the 30-second grace period. The images carry no
init shim: nothing forks, so there are no zombies to reap, and the signal
handling is the application's own.

**Tenant resolution.** A request's tenant comes from the `X-Tenant` header, then
the Host subdomain, then `DEFAULT_TENANT_SLUG`. Bare addresses — IPv4, IPv6,
`localhost`, and single-label Kubernetes service names — always resolve to the
default tenant rather than being parsed as a subdomain. After login the tenant
comes from the signed token and the Host is not consulted at all.

---

## Data protection

Recovery data is among the most sensitive categories of personal data there is:
disclosed to the wrong party it costs people custody, employment and insurance.

- Export (`GET /v1/privacy/export`) returns everything the app holds.
- Deletion (`DELETE /v1/privacy/account`) is a hard delete. Every tenant-scoped
  table cascades from `users`, so check-ins, cravings, relapse autopsies and the
  coach transcript go with it. The audit entry recording the deletion carries no
  user id.
- The `audit_log` table records authentication events, exports and deletions.
- NetworkPolicies default to deny; the API's only egress is DNS, Postgres and
  outbound HTTPS for the Anthropic API.

If you operate this for a clinic or an employer, be explicit with users about
which tenant they are in and who can see what. The isolation is technical; the
honesty has to be yours.
