# ── Stage 1: Build ──────────────────────────────────────────────────────
# Compiles dashboard (Vite) + bundles server (esbuild) + compiles
# better-sqlite3 native addon for the container's glibc/Node ABI.
#
# node:22 (full) includes python3, make, gcc, g++ needed for node-gyp.
# We only switch to -slim in the production stage for minimal image size.
FROM node:22 AS builder

# No apt-get needed — node:22 already has the native build toolchain.

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ── Workspace skeleton ─────────────────────────────────────────────────
# Layer 1: config files (changes rarely → Docker cache friendly)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Layer 2: workspace package manifests
COPY packages/shared-db/package.json ./packages/shared-db/
COPY packages/shared-lib/package.json ./packages/shared-lib/
COPY apps/sync-server/package.json apps/sync-server/tsconfig.json \
     apps/sync-server/esbuild.config.js \
     ./apps/sync-server/

# Layer 3: workspace package sources
COPY packages/shared-db/src/ ./packages/shared-db/src/
COPY packages/shared-lib/src/ ./packages/shared-lib/src/
COPY apps/sync-server/src/ ./apps/sync-server/src/

# Install all workspace dependencies (prod + dev).
# pnpm runs better-sqlite3's install script automatically (allowBuilds).
# --ignore-scripts on root only skips the isolation postinstall (not needed
# in Docker — there's only one Node ABI inside the container).
RUN pnpm install --frozen-lockfile --ignore-scripts && \
    cd /app/apps/sync-server/node_modules/better-sqlite3 && \
    npx node-gyp rebuild --release

# Build dashboard — it's a Vite SPA inside the sync-server tree.
# `pnpm` sees the parent workspace and short-circuits, so use npm directly
# to force a real install into dashboard/node_modules.
COPY apps/sync-server/dashboard/ ./apps/sync-server/dashboard/
RUN cd apps/sync-server/dashboard && \
    rm -rf node_modules && \
    npm install && \
    npx tsc -b && npx vite build

# ── Server bundle (esbuild) ────────────────────────────────────────────
# Runs from sync-server/ so relative paths in esbuild.config.js resolve.
RUN cd apps/sync-server && node esbuild.config.js

# ── Stage 2: Production ─────────────────────────────────────────────────
FROM node:22-slim AS production

WORKDIR /app

# 1. Esbuild bundle → the entire backend in one file
COPY --from=builder /app/apps/sync-server/dist/server.cjs ./dist/server.cjs

# 2. Dashboard static files (SPA served via Hono fallback)
COPY --from=builder /app/apps/sync-server/dist-dashboard/ ./dist-dashboard/

# 3. better-sqlite3 — native addon + JS runtime deps (bindings, file-uri-to-path).
#    These are the ONLY node_modules entries needed; everything else
#    (hono, drizzle-orm, zod, shared-db, shared-lib, ...) is in the esbuild bundle.
#    pnpm hoists better-sqlite3 into node_modules/.pnpm/, so copy the real locations.
COPY --from=builder \
     /app/node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3/ \
     ./node_modules/better-sqlite3/
COPY --from=builder \
     /app/node_modules/.pnpm/bindings@1.5.0/node_modules/bindings/ \
     ./node_modules/bindings/
COPY --from=builder \
     /app/node_modules/.pnpm/file-uri-to-path@1.0.0/node_modules/file-uri-to-path/ \
     ./node_modules/file-uri-to-path/

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

EXPOSE 3001

# Named volume for the SQLite database and uploaded files
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/health').then(r => {if(!r.ok) process.exit(1)})"

CMD ["node", "dist/server.cjs"]
