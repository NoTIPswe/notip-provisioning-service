# ─── Builder ────────────────────────────────────────────────────────────────
FROM ghcr.io/notipswe/notip-nest-base:v0.0.1 AS builder

WORKDIR /app
RUN mkdir -p /app && chown -R node:node /app

USER node

# Cache deps layer separately from source
COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN npm run build

# ─── Production ─────────────────────────────────────────────────────────────
FROM ghcr.io/notipswe/notip-nest-base:v0.0.1 AS prod
LABEL org.opencontainers.image.source="https://github.com/NoTIPswe/notip-provisioning-service/"

ENV NODE_ENV=production
WORKDIR /app
RUN mkdir -p /app && chown -R node:node /app

USER node

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3000

# Requires GET /health → 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

ENTRYPOINT ["node"]
CMD ["dist/main"]