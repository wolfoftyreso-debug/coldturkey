# Self-hosting Cleat

Everything here runs on hardware you control: Kubernetes, PostgreSQL, Gitea,
object storage, mail, and the application itself. No managed database, no
hosted CI, no third-party registry in the serving path.

That choice has a cost and it is worth stating plainly up front: **you are now
the database administrator.** Backups that are never restored are not backups,
and the single most likely way to lose this data is a restore procedure that
nobody has run. The drill in [Restore](#restore) is not optional reading.

---

## What runs where

| Component | What it is | Namespace |
|---|---|---|
| `cleat-api` | Fastify API, stateless, horizontally scaled | `cleat` |
| `cleat-web` | Next.js, standalone output, PWA | `cleat` |
| `cleat-db` | PostgreSQL 16, 3 instances, CloudNativePG | `cleat` |
| `minio` | S3-compatible object store for backups | `cleat-platform` |
| `gitea` | Git hosting, Actions, container registry | `cleat-platform` |
| `gitea-db` | PostgreSQL 16, 2 instances | `cleat-platform` |
| `gitea-runner` | CI runners, docker-in-docker sidecar | `cleat-platform` |

The application namespace and the platform namespace are separate so that CI
load and a compromised build cannot reach the database holding recovery data
by default. The NetworkPolicies assume that separation; do not merge them.

---

## Prerequisites

* A Kubernetes cluster, 1.29 or newer. Three nodes if you want the Postgres
  anti-affinity to do anything.
* A storage class that can provision `ReadWriteOnce` volumes.
* `cert-manager` with a `ClusterIssuer` named `letsencrypt-prod`, or edit
  `deploy/k8s/base/ingress.yaml` to match what you have.
* An ingress controller.
* An SMTP relay. Postfix or Maddy on a small VM is enough. See
  [Mail](#mail) — the API refuses to start in production without one.

---

## Install

Order matters: the operator must exist before the `Cluster` resources, and
MinIO must exist before Postgres tries to archive to it.

```sh
# 1. The Postgres operator.
kubectl apply --server-side -f \
  https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.25/releases/cnpg-1.25.1.yaml
kubectl -n cnpg-system rollout status deployment/cnpg-controller-manager

# 2. Secrets. Generate them; do not copy them from this file.
kubectl create namespace cleat
kubectl create namespace cleat-platform

kubectl -n cleat-platform create secret generic minio-credentials \
  --from-literal=root-user="cleat-backup" \
  --from-literal=root-password="$(openssl rand -base64 36)"
# The Postgres cluster reads the same credentials from its own namespace.
kubectl -n cleat-platform get secret minio-credentials -o yaml \
  | sed 's/namespace: cleat-platform/namespace: cleat/' \
  | kubectl apply -f -

kubectl -n cleat create secret generic cleat-db-app-user \
  --from-literal=username=cleat \
  --from-literal=password="$(openssl rand -base64 36)"

kubectl -n cleat create secret generic cleat-secrets \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=SMTP_PASSWORD="..." \
  --from-literal=ANTHROPIC_API_KEY=""   # optional; see Coach below

kubectl -n cleat-platform create secret generic gitea-db-user \
  --from-literal=username=gitea \
  --from-literal=password="$(openssl rand -base64 36)"
kubectl -n cleat-platform create secret generic gitea-secrets \
  --from-literal=secret-key="$(openssl rand -base64 48)" \
  --from-literal=jwt-secret="$(openssl rand -base64 48)"

# 3. Object storage, then the databases, then the forge.
kubectl apply -f deploy/k8s/platform/minio/
kubectl -n cleat-platform wait --for=condition=Available deploy/minio --timeout=300s

kubectl apply -f deploy/k8s/platform/postgres/
kubectl -n cleat wait --for=condition=Ready cluster/cleat-db --timeout=600s

kubectl apply -f deploy/k8s/platform/gitea/

# 4. The application.
kubectl apply -k deploy/k8s/overlays/prod
```

`JWT_SECRET` must be at least 32 characters or the API refuses to boot. That
check exists because a server that starts with a missing signing key and only
discovers it on the first login is a server that fails in production at the
worst possible moment.

---

## Mail

Password reset and email verification need somewhere to hand a message to.
There are two transports, and you pick one by which credential you set.

| You set | Transport | Use it when |
| --- | --- | --- |
| `SMTP_HOST` (+ `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) | The built-in SMTP client | You run your own relay, or the platform lets you open port 587 |
| `RESEND_API_KEY` | Resend over HTTPS | You are on a container platform that blocks outbound SMTP |

Set both and the API key wins — both configured is not a misconfiguration to
reject, it is somebody midway through a migration, and the key is the newer
deliberate choice. Set neither and the API falls back to a mailer that logs a
digest instead of sending: fine for development, catastrophic in production,
because a reset request would return `202` and the person would wait for a
mail that was never sent.

**So the API refuses to start in production without one of `SMTP_HOST` or
`RESEND_API_KEY`.** A server that will not boot is a bug report; a server that
silently swallows account recovery is not.

The SMTP client upgrades to TLS via STARTTLS whenever the relay offers it, and
authenticates only after the upgrade. Set `SMTP_REJECT_UNAUTHORIZED=false`
only against a relay with a self-signed certificate on a network you control,
and understand that you are turning off the check that stops an attacker on
that network reading every reset link.

Why the HTTPS transport exists at all: managed container platforms block
outbound port 587 by default, to stop themselves becoming spam sources. On
those, an SMTP-only build does not fail loudly — it hangs and then times out,
one reset at a time. `RESEND_API_KEY` routes the same messages over 443.

Whichever transport is in use, `MAIL_FROM` must be an address on a domain the
provider has verified, or the send is refused with `422 validation_error`.

Mail is plain text on purpose. HTML mail here would be a tracking surface
pointed at people in recovery — so open tracking, click tracking, and the
provider's HTML rendering are all left off, and there is a test that fails if
somebody turns one on.

---

## Backups

CloudNativePG writes continuously to MinIO:

* **WAL archiving** — every transaction, compressed, four uploads in parallel.
  This is what makes point-in-time recovery possible.
* **Base backup** — nightly at 02:30 UTC, `ScheduledBackup/cleat-db-nightly`.
* **Retention** — 30 days at the operator, 35 days on the bucket lifecycle
  rule, and object versioning on so a bad backup overwriting a good one is
  recoverable.

Check that archiving is actually keeping up. This is the number that quietly
stops being true while every dashboard stays green:

```sh
kubectl -n cleat get cluster cleat-db \
  -o jsonpath='{.status.conditions[?(@.type=="ContinuousArchiving")]}'
kubectl -n cleat get backup
```

**MinIO on the same cluster is not off-site.** A single-node install has its
backups on the machine that holds the database, which protects against a bad
migration and not against a dead machine, a fire, or a ransomware event.
Replicate the bucket somewhere else, or point `barmanObjectStore` at storage
that is genuinely elsewhere.

---

## Restore

Run this on a schedule — quarterly at minimum — into a throwaway namespace.
A restore procedure that has never been executed is a hypothesis.

> **The compose stack's equivalent has been executed**, against a real running
> deployment, and is written up below under *Drill: compose*. The CloudNativePG
> path here has **not** — it needs a cluster, and remains a hypothesis until
> somebody runs it and writes down the time it took.

```sh
cat <<'EOF' | kubectl apply -f -
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: cleat-db-restore-drill
  namespace: cleat
spec:
  instances: 1
  storage:
    size: 50Gi
  bootstrap:
    recovery:
      source: cleat-db
      recoveryTarget:
        targetTime: "2026-08-09 04:00:00+00"   # a time you want back
  externalClusters:
    - name: cleat-db
      barmanObjectStore:
        destinationPath: s3://cleat-backups/
        endpointURL: http://minio.cleat-platform.svc.cluster.local:9000
        s3Credentials:
          accessKeyId: {name: minio-credentials, key: root-user}
          secretAccessKey: {name: minio-credentials, key: root-password}
EOF
```

Then verify the restore actually contains data rather than an empty schema —
a restore that "succeeded" into an empty database is the failure this drill
exists to catch:

```sh
kubectl -n cleat exec -it cleat-db-restore-drill-1 -- psql -U postgres -d cleat \
  -c 'SELECT count(*) FROM users; SELECT max(created_at) FROM cravings;'
kubectl -n cleat delete cluster cleat-db-restore-drill
```

Write down how long the whole thing took. That number is your real recovery
time objective, and it is usually several times what people assume.

---

## Drill: compose

Executed end to end against the running compose stack, with an account and a
quit plan created through the browser first.

```sh
# 1. Back up. 55 KB, 192 ms.
docker exec deploy-postgres-1 pg_dump -U cleat -d cleat -Fc -f /tmp/cleat.dump
docker cp deploy-postgres-1:/tmp/cleat.dump ./cleat.dump

# 2. Lose everything, including the volume.
docker compose -f deploy/docker-compose.yml down -v

# 3. Bring it back and restore.
docker compose -f deploy/docker-compose.yml up -d
docker cp ./cleat.dump deploy-postgres-1:/tmp/cleat.dump
docker exec deploy-postgres-1 pg_restore -U cleat -d cleat --clean --if-exists /tmp/cleat.dump
```

**Six seconds**, from destroyed volume to restored database, on a small
dataset. What was checked afterwards, because a restore that returns rows
nobody can use is not a restore:

* row counts match — users, quits, profiles
* `/readyz` reports `database: ok`
* every table carrying `tenant_id` still has **forced** row level security;
  a dump that silently dropped the policies would look like a perfect restore
  and quietly make every tenant readable by every other
* the restored account signs in with its original password, and its plan is
  on screen — so the password hashes and the encrypted columns both survived,
  which is the part that fails if the keyring and the data get separated

Scale honestly: six seconds is a drill, not a capacity measurement. Re-run it
against a database the size of your real one before quoting a recovery time to
anybody.

## CI on Gitea

`.gitea/workflows/ci.yaml` is the same pipeline as the GitHub one, not a
reduced version — typecheck, tests against a real PostgreSQL, API build, web
build, and a mobile bundle. Every one of those steps has caught a real defect
in this codebase, and the mobile bundle step exists because the app once
typechecked cleanly and could not build at all.

Register a runner:

```sh
# Get a registration token from Gitea: Site Administration → Actions → Runners
kubectl -n cleat-platform create secret generic gitea-runner-token \
  --from-literal=token="<token>"
kubectl -n cleat-platform rollout restart deploy/gitea-runner
```

The runner uses a docker-in-docker sidecar rather than mounting the node's
Docker socket. Mounting the host socket would give any CI job root on the node
that also runs the database — a compromised dependency in a test would own the
recovery data.

---

## The registry

Gitea's built-in OCI registry serves the application images, so the cluster
does not pull its own software from infrastructure somebody else operates.
Log in with a Gitea personal access token that has `write:package`, and store
it as `REGISTRY_TOKEN` in the repository's Actions secrets.

Set the image references in `deploy/k8s/overlays/prod` to
`git.<your-domain>/cleat/api` and `.../web`.

### Building behind a TLS-inspecting proxy

A corporate middlebox or a locked-down runner presents its own certificate for
outbound HTTPS, and the dependency install inside the image then dies on
`SELF_SIGNED_CERT_IN_CHAIN`. Pass the CA as a build secret:

```sh
docker build -f apps/api/Dockerfile \
  --secret id=ca,src=/etc/ssl/certs/your-proxy-ca.crt \
  -t git.<your-domain>/cleat/api:$TAG .
```

It is a secret rather than a `COPY`, so it never lands in a layer of the image
you push. Without it the build is unchanged.

### The web image takes no API URL

There is deliberately no `--build-arg NEXT_PUBLIC_API_URL` in the build above.
The Ingress serves `/v1` from the API on the app's own hostname, so the browser
calls the origin it loaded the page from — which means the same image works on
any domain, and you never have to rebuild from source to point it at yours.

If you do move the API to a separate hostname, the value has to be set as a
build arg *and* as an environment variable on the web Deployment: the bundle
inlines it at build time, while the `connect-src` in the Content-Security-Policy
is built by the running server. Set one without the other and the browser
refuses every API call while the pods stay healthy and nothing is logged.

---

## Coach

`ANTHROPIC_API_KEY` is optional. Without it the product runs a local coach
that is not a stub: the ten-minute protocol, the craving plan, the negotiation
counters, the safety triage and the insights all run on the server with no
model involved. The same path is used when the network fails, when the model
declines, and when a request times out.

If you want the deployment to have no external dependency at all, leave the
key unset. You lose conversational coaching and keep everything that matters
at 2am.

Safety triage runs before the model in every case and cannot be disabled.

---

## Encryption at rest

Free text people write — coach transcripts, relapse notes, craving notes, the
why statement, and support contacts' names and phone numbers — is encrypted
with AES-256-GCM before it reaches Postgres.

The threat this closes is not a live attacker with a valid session; row level
security handles that. It is the copy of the data that leaves the database: a
backup restored on a laptop, a replica on a decommissioned disk, a snapshot in
an object store, an operator running a SELECT. Row level security protects
none of those.

```sh
kubectl -n cleat create secret generic cleat-secrets \
  --from-literal=FIELD_ENCRYPTION_KEYS="k1:$(openssl rand -base64 32)" \
  --from-literal=FIELD_ENCRYPTION_ACTIVE_KEY=k1 \
  …
```

**The API refuses to start in production without a key.** Storing recovery
notes in cleartext should be a decision somebody makes, not a default they
inherit.

Two properties worth knowing:

* **Every value is bound to its row.** The additional authenticated data is
  `tenant/table/column/owner`, so a ciphertext cannot be moved from one
  person's row into another's, or from a note into a why statement, and still
  decrypt. Confidentiality alone is not enough when an attacker can shuffle
  records.
* **Rotation is lazy.** The stored format names the key that encrypted it.
  Add a new key, point `FIELD_ENCRYPTION_ACTIVE_KEY` at it, and keep the old
  one loaded; values re-encrypt as they are rewritten. Removing a key before
  its data has been rewritten strands that data permanently.

**Back up the keys separately from the database.** A backup you cannot decrypt
is not a backup, and the key must not live in the same blast radius as the
ciphertext.

Every free-text column a person writes into is covered: coach transcripts, the
why statement, craving, relapse, check-in and life-domain notes, trigger
labels, support contact names and phone numbers, and the TOTP secret.

Not encrypted, deliberately: anything queried, sorted or joined on. Encrypting
an indexed column turns lookups into full scans or breaks them outright.

## Observability

`deploy/k8s/platform/observability/` runs Prometheus, Alertmanager and
Grafana. The point is narrower than usual: not dashboards, but noticing that
the craving screen has been failing since 2am before somebody's week goes past
without the tool they were relying on.

The alert rules worth knowing about:

* **PostgresArchivingBroken** — WAL archiving failing means point-in-time
  recovery has quietly stopped being possible. Nothing else reports this, and
  it stays invisible until the restore that needed it.
* **MailDeliveryFailing** — password reset is broken, which means people are
  locked out of their own recovery history.
* **ApiErrorRateHigh**, **ApiDown**, **NoRecentBackup**.

The config and the rules are validated with `promtool` in CI, not only as
Kubernetes objects. A ConfigMap can be perfectly valid Kubernetes and still
contain a Prometheus config that refuses to load — which is exactly what
happened on the first version of this file.

**The `/metrics` endpoint carries nothing about a person.** No user id, no
tenant id, no free text, route templates rather than resolved URLs, and an
unmatched path recorded as `unmatched` rather than echoed. Enforced by tests
in the API, because a metrics store is scraped, kept for months and rendered
on dashboards shared far more casually than a database.

Error reports are pseudonymised the same way: the user is a hash salted with a
secret that never leaves the deployment, so the same person is recognisable
across two reports without the error store learning who they are. No request
bodies, no headers, no query strings. Point `ERROR_REPORTING_URL` at a
self-hosted GlitchTip, or leave it unset and reports go to the log.

## Capacity

Measured on one process against a database on the same four-core machine, so
treat these as a floor rather than a spec:

| Endpoint | Saturates around | p99 at 50 concurrent |
|---|---|---|
| `GET /v1/dashboard` | ~990 req/s | 93 ms |
| `POST /v1/coach/message` (local coach) | ~790 req/s | 87 ms |
| `GET /v1/public/safety/resources` | ~6300 req/s | 16 ms |

The work is database-bound, not CPU-bound, so CPU utilisation lags: latency
degrades before the number moves. The HPA target is 60% rather than 70% for
that reason.

Note for anyone repeating this: the first run reported thousands of requests
per second and was measuring nothing but the rate limiter saying no. Check
the error count before believing a load test.

## What this does not give you

Stated plainly, because a self-hosting guide that implies completeness is
worse than none:

* **No clinical review.** The safety triage was written by a developer and
  tested against a corpus the same developer wrote. It has never been read by
  anyone with clinical competence in addiction or suicide prevention.
* **No legal review.** No DPIA, no privacy policy, no terms, no processor
  agreement, and no position taken on whether this is a medical device under
  EU MDR. Health data is a special category under GDPR Article 9 and running
  it on your own hardware does not change that.
* **No encryption at rest of individual fields.** `pgcrypto` is installed but
  unused; coach transcripts and relapse history sit in the clear inside the
  database. Disk-level encryption is your storage layer's job and is not
  configured here.
* **No penetration test.** Nothing here has been attacked by anyone whose job
  it is to attack it.
* **No 2FA.** Password plus email recovery is the whole of the account
  security story.
* **No disaster-recovery run book beyond the restore drill above.** There is
  no documented procedure for losing the whole cluster.

See `DEEP_RESEARCH_BRIEF.md` for the full gap list and its reasoning.
