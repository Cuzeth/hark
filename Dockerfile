# syntax=docker/dockerfile:1

FROM node:22-trixie-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---------------------------------------------------------------------------
# Build: install workspace deps, build the SPA and bundle the Hono server.
# ---------------------------------------------------------------------------
FROM base AS build
# Toolchain for better-sqlite3 when no prebuilt binary matches this platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY apps/website/package.json apps/website/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter hark --filter @hark/website --filter @hark/contracts
COPY packages ./packages
COPY apps/website ./apps/website
RUN pnpm --filter @hark/website build
# Produce a standalone production folder (prod node_modules + built output).
RUN pnpm --filter @hark/website deploy --prod --legacy /out

# ---------------------------------------------------------------------------
# Runtime: single process serving the API and the static SPA.
# SQLite persists under /data (mount a volume there).
# ---------------------------------------------------------------------------
FROM node:22-trixie-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8787
ENV DATABASE_URL=/data/hark.sqlite
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /out/drizzle ./drizzle
COPY --from=build /out/package.json ./package.json
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrations run inside the server process before it starts listening.
CMD ["node", "dist/server/index.js"]
