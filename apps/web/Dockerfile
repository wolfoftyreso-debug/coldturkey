# syntax=docker/dockerfile:1.7
#
# Cold Turkey web image, using Next.js standalone output so the runtime layer is
# a few megabytes of server plus static assets rather than the whole workspace.
#
# Note the build argument: NEXT_PUBLIC_* values are inlined at build time, so the
# API URL is baked into the image and cannot be changed by an environment
# variable at deploy time. Build one image per environment, or serve the API from
# a same-origin path.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/i18n/package.json packages/i18n/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile \
      --filter @coldturkey/web... \
      --filter @coldturkey/core \
      --filter @coldturkey/i18n

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ARG NEXT_PUBLIC_DEFAULT_TENANT=public
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEFAULT_TENANT=$NEXT_PUBLIC_DEFAULT_TENANT
ENV NEXT_TELEMETRY_DISABLED=1
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY packages/i18n packages/i18n
COPY apps/web apps/web
RUN pnpm --filter @coldturkey/core build \
 && pnpm --filter @coldturkey/i18n build \
 && pnpm --filter @coldturkey/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

RUN apk add --no-cache tini \
 && addgroup -g 10001 -S app \
 && adduser -u 10001 -S app -G app

COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public

USER 10001
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
