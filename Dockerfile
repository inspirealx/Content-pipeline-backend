# Production Backend Dockerfile - Debian-based for Prisma stability
# Uses Debian Slim for glibc compatibility with Prisma

FROM node:20-bookworm-slim AS base

# Install OpenSSL, curl for healthchecks, and other dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Build stage - includes dev dependencies for Prisma
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for Prisma)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client with correct binary target
RUN npx prisma generate

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home backend

# Copy dependencies from deps stage
COPY --from=deps --chown=backend:nodejs /app/node_modules ./node_modules

# Copy Prisma generated client from builder
COPY --from=builder --chown=backend:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=backend:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# Copy application code
COPY --chown=backend:nodejs . .

# Switch to non-root user
USER backend

EXPOSE 3000

# Health check using curl (Coolify-compatible)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start command (runs migrations then starts server)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
