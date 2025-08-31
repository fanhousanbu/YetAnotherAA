# Multi-stage build for combined aastar application
FROM node:20.19.0 AS base

# Backend dependencies
FROM base AS backend-deps
WORKDIR /app/backend
COPY aastar/package*.json ./
RUN npm install --omit=dev

# Backend build
FROM base AS backend-build
WORKDIR /app/backend
COPY aastar/package*.json ./
RUN npm install
COPY aastar/ ./
RUN npm run build

# Frontend dependencies
FROM base AS frontend-deps
WORKDIR /app/frontend
COPY aastar-frontend/package*.json ./
RUN npm install --omit=dev

# Frontend build
FROM base AS frontend-build
WORKDIR /app/frontend
COPY aastar-frontend/package*.json ./
RUN npm install
COPY aastar-frontend/ ./
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV SKIP_ENV_VALIDATION=true
RUN npm run build

# Production image with both services
FROM base AS production
WORKDIR /app

# Install PM2 for process management
RUN npm install -g pm2

# Create non-root user with home directory
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --home /home/nodejs --shell /bin/bash nodejs

# Copy backend
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package*.json ./backend/

# Copy frontend
COPY --from=frontend-deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-build /app/frontend/.next ./frontend/.next
COPY --from=frontend-build /app/frontend/public ./frontend/public
COPY --from=frontend-build /app/frontend/package*.json ./frontend/
COPY --from=frontend-build /app/frontend/next.config.ts ./frontend/

# Copy PM2 ecosystem file
COPY ecosystem.config.js ./

# Copy data directory with configurations
COPY aastar/data ./backend/data/

# Change ownership
RUN chown -R nodejs:nodejs /app
RUN mkdir -p /home/nodejs/.pm2 && chown -R nodejs:nodejs /home/nodejs

USER nodejs
ENV PM2_HOME=/home/nodejs/.pm2

EXPOSE 80

CMD ["pm2-runtime", "start", "ecosystem.config.js"]