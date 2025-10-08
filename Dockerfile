# YetAnotherAA Docker All-in-One
FROM node:20.19.0-alpine

WORKDIR /app

# Install PM2 globally
RUN npm install -g pm2 && apk add --no-cache git

# Copy package files
COPY package*.json ./
COPY signer/package*.json ./signer/
COPY aastar/package*.json ./aastar/
COPY aastar-frontend/package*.json ./aastar-frontend/

# Install dependencies with force flag to bypass platform-specific issues
RUN npm ci --include=dev --force

# Copy source code
COPY . .

# Build all applications
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV BACKEND_API_URL=http://localhost:3000
RUN npm run build -w signer && \
    npm run build -w aastar && \
    npm run build -w aastar-frontend

# Copy configuration files
COPY signer/node_dev_001.json ./signer/
COPY ecosystem.config.js ./

# Expose port for frontend
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start all services with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]