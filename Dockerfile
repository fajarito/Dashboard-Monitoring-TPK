# syntax=docker/dockerfile:1
# Multi-stage image for OpenShift (non-root, PORT default 8080).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# OpenShift assigns an arbitrary non-root UID; keep tree group-writable.
RUN mkdir -p /app/.next \
  && chgrp -R 0 /app \
  && chmod -R g=u /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Arbitrary UID compatible with OpenShift restricted SCC.
USER 1001

EXPOSE 8080

CMD ["npm", "run", "start"]
