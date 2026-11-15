# Use official Node.js 20 slim runtime
FROM node:20-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Copy dependency definitions
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application source code
COPY --chown=node:node . .

# Run as non-root user
USER node

# Expose target port (Cloud Run sets PORT env var)
EXPOSE 8080

# Built-in container healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/healthz || exit 1

# Start service
CMD ["node", "src/server.js"]
