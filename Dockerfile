# Stage 1: Build static assets and server output
FROM node:22-alpine AS builder
WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm ci --only=production=false

# Copy code and build
COPY . .
RUN npm run build

# Stage 2: Serve with lightweight Node (Non-root)
FROM node:22-alpine AS runner
WORKDIR /app

# Create a non-root group and user
RUN addgroup -S nodeuser && adduser -S nodeuser -G nodeuser

# Copy build artifacts and package configs
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package*.json ./

# Secure runtime privileges
USER nodeuser

# Expose default port
EXPOSE 8080

# Configure production server environment
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Run the TanStack Start (Nitro) entrypoint server
CMD ["node", ".output/server/index.mjs"]
