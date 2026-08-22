# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# A single-instance image: Next's standalone server plus a SQLite file on a
# volume. That shape is deliberate — see DEVELOPMENT.md § 部署 for when to stop
# using it (multiple replicas, or a write volume you can't mount).
#
# ⚠️ NOT BUILT. Docker was unavailable in the environment this was written in, so
# every *other* part of the deployment path was verified by running it directly —
# `output: 'standalone'`, the traced libsql native addon, the `.next/static` copy,
# and the bundled migrator under plain Node (see § 部署). This file expresses
# those verified facts, but the image itself has never been built. Treat the first
# `docker build` as a review step.
# ─────────────────────────────────────────────────────────────────────────────

# ── deps ─────────────────────────────────────────────────────────────────────
# Split from the build stage so a source-only change doesn't re-resolve packages.
FROM oven/bun:1.3.3-alpine AS deps
WORKDIR /app
# The lockfile and the patch have to come together: `bun install --frozen-lockfile`
# applies patchedDependencies, and the patch file is referenced from package.json.
COPY package.json bun.lock ./
COPY patches ./patches
RUN bun install --frozen-lockfile

# ── build ────────────────────────────────────────────────────────────────────
FROM oven/bun:1.3.3-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `next build` evaluates src/core/env.ts, which *requires* AUTH_SECRET — verified:
# building without it fails with "Invalid environment variables: [ path:
# ['AUTH_SECRET'] ]". This placeholder exists only to get the build to run; it is
# never the secret the container signs JWTs with, because env.ts is re-evaluated at
# startup from the real runtime environment.
#
# Deliberately not an ARG: an ARG invites passing the real secret at build time,
# which would bake it into the image layers.
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime"
ENV NODE_ENV=production

# Opts this build into `output: 'standalone'`. It is off by default because it is
# incompatible with `next start`, which the repo's own `start` script and the
# Playwright webServer both use — see next.config.ts.
ENV NEXT_OUTPUT=standalone

RUN bun run build

# The migrator, bundled for Node because the runtime image has neither Bun nor the
# sources. See src/core/db/migrate-cli.ts for why it's a dedicated entry and why
# @libsql/client stays external.
RUN bun build src/core/db/migrate-cli.ts \
      --target=node \
      --outfile=.next/standalone/migrate.mjs \
      --external @libsql/client

# ── runtime ──────────────────────────────────────────────────────────────────
# Node, not Bun: `server.js` from the standalone output is what Next supports, and
# `engines` pins node >=20.9.0. Matches .nvmrc.
#
# ⚠️ **Keep every stage on the same libc.** All three are Alpine, i.e. musl, and
# that is load-bearing rather than a size preference: `output: 'standalone'` traces
# the *build* stage's platform-specific `.node` addon into the output, so a Debian
# build stage (`oven/bun:1.3.3`) feeding an Alpine runtime would copy in
# `@libsql/linux-x64-gnu` and the server would die on its first query. If you switch
# one stage off Alpine, switch them all.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The database lives on a volume, not in the image layers. Overriding
# DATABASE_URL to a path outside /data means writes land in the container's
# writable layer and vanish on restart.
ENV DATABASE_URL=/data/app.db

RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
# Neither of these is included in the standalone output — Next's docs are explicit
# that they're expected to be served by a CDN. Verified what happens without the
# second one: every /_next/static request 500s, so the app renders unstyled.
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# The migrator reads its SQL from ./drizzle relative to the working directory.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle

# `public/` is copied only if it exists — this template ships no such directory,
# and a plain COPY of a missing path fails the build. Uncomment when you add one.
# COPY --from=build --chown=nextjs:nodejs /app/public ./public

RUN mkdir -p /data && chown nextjs:nodejs /data
VOLUME ["/data"]
USER nextjs
EXPOSE 3000

# Migrations run at startup, in the same container.
#
# That's appropriate for *this* shape and not in general: one instance, and a
# database that is a file on the volume this container just mounted, so there's no
# separate service to migrate against and no second replica to race. Two replicas
# both running this would race the same file — at which point migrations belong in
# a separate job that runs to completion before any replica starts. See
# DEVELOPMENT.md § 部署.
#
# `sh -c` with `&&` so a failed migration stops the boot instead of serving traffic
# against a schema that doesn't match the code.
CMD ["sh", "-c", "node migrate.mjs && node server.js"]
