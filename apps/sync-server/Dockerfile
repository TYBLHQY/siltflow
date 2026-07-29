# ── Build stage ────────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10 --activate

# Install all workspace deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-db/package.json packages/shared-db/
COPY packages/shared-lib/package.json packages/shared-lib/
COPY apps/sync-server/package.json apps/sync-server/

RUN apk add --no-cache python3 make g++ && \
    pnpm install --frozen-lockfile && \
    apk del python3 make g++

# Copy source and build
COPY packages/shared-db/ packages/shared-db/
COPY packages/shared-lib/ packages/shared-lib/
COPY apps/sync-server/ apps/sync-server/

WORKDIR /app/apps/sync-server
RUN pnpm run build:server && pnpm run build:dashboard

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM node:24-alpine

RUN addgroup -S siltflow && adduser -S siltflow -G siltflow

# better-sqlite3 is the only native module not bundled by esbuild.
# Install it fresh so the .node binary matches the runtime's musl libc.
WORKDIR /app
COPY --from=build /app/apps/sync-server/package.json /app/
RUN apk add --no-cache python3 make g++ && \
    npm install --omit=dev better-sqlite3@12 && \
    apk del python3 make g++

# Copy esbuild output (server.cjs) and dashboard SPA
COPY --from=build /app/apps/sync-server/dist /app/dist
COPY --from=build /app/apps/sync-server/dist-dashboard /app/dist-dashboard

RUN mkdir -p /data && chown siltflow:siltflow /data

USER siltflow
EXPOSE 3001
ENV DATA_DIR=/data PORT=3001

CMD ["node", "/app/dist/server.cjs"]
