# ==============================================================================
# Multi-stage Production Dockerfile for Mupost
# Ultra-lightweight (~160MB), Secure (non-root), & Blazing Fast
# ==============================================================================

# ── 1. Base Stage: Node.js 22 Debian Slim (glibc, high performance) ───────────
FROM node:22-slim AS base
WORKDIR /app

# ── 2. Dependencies Stage ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── 3. Builder Stage ──────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Placeholder environment variables for build-time static evaluation (real secrets injected at runtime)
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mupost" \
    REDIS_URL="redis://localhost:6379" \
    TOKEN_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
    NEXTAUTH_SECRET="supersecretjwtstringchangeinproduction123456" \
    META_APP_ID="build_placeholder" \
    META_APP_SECRET="build_placeholder" \
    TIKTOK_CLIENT_KEY="build_placeholder" \
    TIKTOK_CLIENT_SECRET="build_placeholder" \
    S3_BUCKET="mupost-media" \
    S3_ENDPOINT="http://localhost:9000" \
    S3_ACCESS_KEY="minioadmin" \
    S3_SECRET_KEY="minioadmin" \
    PORT=4829

# 1. Build Next.js Web App (standalone output)
RUN npm run build

# 2. Bundle Background Worker & Migration script with esbuild into standalone directory
RUN npx esbuild src/workers/index.ts --bundle --platform=node --target=node22 --outfile=.next/standalone/worker.js --external:pg --external:pg-native --external:ioredis && \
    npx esbuild src/lib/db/migrate.ts --bundle --platform=node --target=node22 --outfile=.next/standalone/migrate.js --external:pg --external:pg-native && \
    cp -r drizzle .next/standalone/

# ── 4. Unified Production Runner (~160MB) ────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4829
ENV HOSTNAME="0.0.0.0"

# Create non-root system user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs mupost

# Copy standalone distribution
COPY --from=builder /app/public ./public
COPY --from=builder --chown=mupost:nodejs /app/.next/standalone ./
COPY --from=builder --chown=mupost:nodejs /app/.next/static ./.next/static

USER mupost
EXPOSE 4829

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4829/login').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Default command starts the Next.js server; worker & migrate override this in docker-compose.yml
CMD ["node", "server.js"]
