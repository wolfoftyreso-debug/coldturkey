#!/usr/bin/env bash
#
# Run the end-to-end suite against a real API, a real database and a real
# browser, in the same shape production runs: one origin, /v1 proxied to the
# API.
#
# The same script is used locally and in CI, so a green pipeline means the thing
# a developer can reproduce. Everything it starts is torn down on exit, however
# the run ends.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ORIGIN_PORT="${E2E_ORIGIN_PORT:-3100}"
WEB_PORT="${E2E_WEB_UPSTREAM:-3101}"
API_PORT="${E2E_API_UPSTREAM:-8081}"

export DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
export JWT_SECRET="${JWT_SECRET:-e2e-secret-at-least-32-characters-long!!}"
# Without keys the app runs unencrypted, which is a different product to the one
# we ship. The suite runs against the configuration that goes to production.
export FIELD_ENCRYPTION_KEYS="${FIELD_ENCRYPTION_KEYS:-e2e:ZTJlLWtleS1mb3ItdGVzdHMtb25seS0zMi1ieXRlcyE=}"
export E2E_BASE_URL="http://127.0.0.1:${ORIGIN_PORT}"

# A mailbox for the suite. Without one, account recovery cannot be exercised at
# all: the reset token is hashed in the database and the development mailer logs
# a digest instead of the link, both deliberately. See scripts/e2e-smtp.mjs.
export E2E_SMTP_PORT="${E2E_SMTP_PORT:-2525}"
export E2E_MAIL_FILE="${E2E_MAIL_FILE:-/tmp/cleat-e2e-mail.jsonl}"
export SMTP_HOST=127.0.0.1
export SMTP_PORT="$E2E_SMTP_PORT"
# An API key takes precedence over a relay host, so one left in a developer's
# shell would send this suite's password resets to real inboxes over the real
# internet. The suite picks its own transport.
unset RESEND_API_KEY
# The enquiry form is opt-in, because the public marketing deployment has no API
# behind it and a form that cannot submit should not be on the page. This suite
# runs the whole stack, so it turns the form on and exercises it.
export NEXT_PUBLIC_ENQUIRY_FORM=on
export MAIL_FROM="${MAIL_FROM:-cleat@cleat.test}"
# The links in those mails have to point at the origin the browser is on, or the
# reset page opens on a host that is not running.
export PUBLIC_WEB_URL="$E2E_BASE_URL"

pids=()
cleanup() {
  local status=$?
  for pid in "${pids[@]:-}"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  exit $status
}
trap cleanup EXIT INT TERM

wait_for() { # url, label
  local url="$1" label="$2" i=0
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    i=$((i + 1))
    if [[ $i -gt 120 ]]; then
      echo "e2e: $label never became ready at $url" >&2
      return 1
    fi
    sleep 1
  done
  echo "e2e: $label ready"
}

echo "e2e: building"
pnpm --filter @cleat/core build
pnpm --filter @cleat/i18n build
pnpm --filter @cleat/api build
# No NEXT_PUBLIC_API_URL: same origin, exactly as the image is built. NODE_ENV
# is production for the build — Next's static export of the error pages fails
# outright under a development NODE_ENV.
(cd apps/web && NODE_ENV=production NEXT_PUBLIC_DEFAULT_TENANT=public pnpm exec next build)

# The API runs with NODE_ENV=development on purpose: production mode refuses to
# boot without SMTP and a non-wildcard CORS origin, which are deployment
# concerns rather than anything this suite exercises.
echo "e2e: starting smtp sink on ${E2E_SMTP_PORT}"
node scripts/e2e-smtp.mjs &
pids+=($!)

echo "e2e: starting api on ${API_PORT}"
NODE_ENV=development PORT="$API_PORT" node apps/api/dist/server.js &
pids+=($!)

echo "e2e: starting web on ${WEB_PORT}"
(cd apps/web && NODE_ENV=production NEXT_PUBLIC_DEFAULT_TENANT=public pnpm exec next start -p "$WEB_PORT") &
pids+=($!)

echo "e2e: starting origin proxy on ${ORIGIN_PORT}"
E2E_ORIGIN_PORT="$ORIGIN_PORT" E2E_WEB_UPSTREAM="$WEB_PORT" E2E_API_UPSTREAM="$API_PORT" \
  node scripts/e2e-origin.mjs &
pids+=($!)

wait_for "http://127.0.0.1:${API_PORT}/healthz" "api"
wait_for "http://127.0.0.1:${WEB_PORT}/login" "web"
wait_for "http://127.0.0.1:${ORIGIN_PORT}/login" "origin"

# The header the whole architecture depends on. Assert it here too: if this is
# wrong the browser refuses every API call and the suite fails with twenty
# confusing timeouts instead of one clear message.
csp="$(curl -fsSI "http://127.0.0.1:${ORIGIN_PORT}/login" | tr -d '\r' | grep -i '^content-security-policy:' || true)"
echo "e2e: ${csp}"
if [[ "$csp" != *"connect-src 'self'"* ]]; then
  echo "e2e: connect-src does not permit the same origin — the app cannot reach its own API" >&2
  exit 1
fi

echo "e2e: running playwright"
(cd apps/web && pnpm exec playwright test "$@")
