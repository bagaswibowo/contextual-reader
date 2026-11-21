# Contextual Reader - All-in-One Multi-Stage Dockerfile
# Builds React frontend and packages with Django backend + Nginx

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 15 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Build Backend Dependencies
FROM python:3.11-slim AS backend-builder
WORKDIR /app
ENV PIP_RETRIES=15 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install --user -r requirements.txt

# Stage 3: Production Runtime
FROM python:3.11-slim
WORKDIR /app

ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

# Install Nginx and curl
RUN apt-get update && apt-get install -y nginx curl && rm -rf /var/lib/apt/lists/*

# Copy Python packages from backend builder
COPY --from=backend-builder /root/.local /root/.local

# Copy frontend static build from frontend builder
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Copy Nginx configuration and clean default site
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Copy backend code
COPY backend/ /app/

# Setup directories
RUN mkdir -p /app/db_data /app/media /app/logs /var/log/nginx

# Copy entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://127.0.0.1:80/api/core/health/ || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
