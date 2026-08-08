# syntax=docker/dockerfile:1.7
#
# Cold Turkey API image.
#
# Multi-stage: the build stage carries pnpm and the whole workspace, the runtime
# stage carries only compiled JavaScript and production dependencies. The final
# image runs as a non-root user with a read-only-friendly layout, because this
# service holds addiction histories and the blast radius of a compromise should
# be as small as we can make it.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ------------------------------------------------------------------- deps ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/i18n/package.json packages/i18n/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter @coldturkey/api... \
      --filter @coldturkey/core \
      --filter @coldturkey/i18n

# ------------------------------------------------------------------ build ---
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/i18n packages/i18n
COPY apps/api apps/api
RUN pnpm --filter @coldturkey/core build \
 && pnpm --filter @coldturkey/i18n build \
 && pnpm --filter @coldturkey/api build

# Strip dev dependencies and flatten the workspace links into a self-contained
# tree, so the runtime stage needs no pnpm and no workspace at all.
#
# `--legacy` is required from pnpm 10: without it, `deploy` refuses to run unless
# the workspace sets `inject-workspace-packages=true`, which would change local
# development ergonomics (every edit to packages/core would need a reinstall) to
# suit the container build. The legacy path produces the same result here.
#
# `deploy` copies the whole package directory regardless of the `files` field, so
# the build inputs are removed explicitly — the runtime image should contain what
# runs and nothing else.
RUN pnpm --filter @coldturkey/api --prod --legacy deploy /deploy \
 && rm -rf /deploy/src /deploy/tsconfig.json /deploy/vitest.config.ts /deploy/Dockerfile

# ---------------------------------------------------------------- runtime ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# tini reaps zombies and forwards SIGTERM, so Kubernetes rolling updates drain
# in-flight requests instead of being killed after the grace period.
RUN apk add --no-cache tini \
 && addgroup -g 10001 -S app \
 && adduser -u 10001 -S app -G app

COPY --from=build --chown=app:app /deploy /app

USER 10001
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
