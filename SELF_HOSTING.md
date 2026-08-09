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

Password reset and email verification need a relay. Without `SMTP_HOST` the
API falls back to a mailer that logs a digest instead of sending — fine for
development, catastrophic in production, because a reset request would return
`202` and the person would wait for a mail that was never sent.

**So the API refuses to start in production without `SMTP_HOST`.** A server
that will not boot is a bug report; a server that silently swallows account
recovery is not.

The SMTP client upgrades to TLS via STARTTLS whenever the relay offers it, and
authenticates only after the upgrade. Set `SMTP_REJECT_UNAUTHORIZED=false`
only against a relay with a self-signed certificate on a network you control,
and understand that you are turning off the check that stops an attacker on
that network reading every reset link.

Mail is plain text on purpose. HTML mail here would be a tracking surface
pointed at people in recovery.

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
* **No error reporting.** A crash in production is currently invisible.
* **No capacity profiling.** The HPA thresholds are a guess. Nobody has
  measured what one pod handles.
* **The login lockout has no shared store.** Counters are per-pod, so the
  effective ceiling multiplies by replica count.

See `DEEP_RESEARCH_BRIEF.md` for the full gap list and its reasoning.
