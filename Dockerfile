# Use the same frozen Bun lockfile as CI and local development.
FROM oven/bun:1.4.3 AS bun
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
# Only the selected public backend configuration is bundled. Privileged
# credentials must be supplied securely at runtime, never as build arguments.
RUN bun run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
COPY --from=builder --chown=node:node /app/.output ./.output
USER node
EXPOSE 8080
ENV PORT=8080 HOST=0.0.0.0 NODE_ENV=production
CMD ["node", ".output/server/index.mjs"]
