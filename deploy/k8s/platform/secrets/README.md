# Secrets

Everything in this repository is committed. Secrets are not, and the gap
between those two facts is where most self-hosted deployments end up keeping a
`secrets.yaml` on somebody's laptop, out of date, with the only copy of the
production JWT signing key in it.

This directory holds the way out: **sealed secrets**. A SealedSecret is
encrypted with a public key that only the in-cluster controller can decrypt.
It is safe to commit, it survives the laptop, and restoring the cluster does
not depend on anyone remembering what was in a Secret.

## Why not SOPS

SOPS is the obvious alternative and it is a reasonable choice. It is not the
one here because it needs a key management story of its own — age keys or a
KMS — and on a self-hosted cluster the KMS would be one more thing to run and
back up. Sealed-secrets keeps the private key inside the cluster that already
has to be backed up, which is one secret to protect rather than two.

The trade is real and worth stating: **lose the controller's private key and
every sealed secret in this repository becomes undecryptable.** Back it up, and
back it up somewhere that is not the cluster.

## Install

```sh
kubectl apply -f \
  https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/controller.yaml
kubectl -n kube-system rollout status deployment/sealed-secrets-controller
```

Install `kubeseal` locally to match the controller version.

## Back up the private key first

Do this before sealing anything. It is the single most important command in
this directory.

```sh
kubectl -n kube-system get secret \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-key.yaml
```

Store that file the way you would store the master key to the database,
because functionally it is. Not in this repository. Not on the cluster.
Encrypted, offline, and somewhere a second person can reach it if you cannot.

## Seal a secret

```sh
kubectl create secret generic cleat-secrets \
  --namespace cleat \
  --dry-run=client -o yaml \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=DATABASE_URL='postgres://cleat:...@cleat-db-rw.cleat.svc.cluster.local:5432/cleat?sslmode=require' \
  --from-literal=SMTP_PASSWORD='...' \
  --from-literal=ANTHROPIC_API_KEY='' \
  | kubeseal --format yaml > deploy/k8s/platform/secrets/cleat-secrets.sealed.yaml
```

The output is safe to commit. The input never touches disk — note the pipe.

## Rotating

Rotating `JWT_SECRET` signs every existing access token out. That is the
intended behaviour when you believe a key is compromised, and a surprise when
you are only doing housekeeping: everyone using the product at that moment is
returned to the login screen, some of them mid-craving. Rotate deliberately,
and prefer a quiet hour.

Rotating the database password requires updating the CloudNativePG bootstrap
secret and restarting the API; the operator does not propagate it on its own.

## What must never be sealed into this repository

* The sealed-secrets private key. It decrypts everything else.
* A CloudNativePG backup credential that also grants delete on the bucket.
  Backups an attacker can delete are not a defence against ransomware.
* Anything derived from a person's data. There is no legitimate reason for a
  secret in this product to contain a user identifier.
