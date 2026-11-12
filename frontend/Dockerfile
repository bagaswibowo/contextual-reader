# Dockerfile untuk Frontend (Contextual Reader)
# Minimal cleanup: buang build tools, pakai nginx + WhiteNoise untuk static

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci --only=production

# Build aplikasi
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Stage 2: Production
FROM nginx:1.27-alpine

# Copy built files dari builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy WhiteNoise static files (jika ada dari backend)
COPY backend/staticfiles /usr/share/nginx/html/static 2>/dev/null || true

# Create logs directory
RUN mkdir -p /var/log/nginx

# Expose port
EXPOSE 80

# Healthcheck
RUN apk add --no-cache curl && sleep 2 && curl -f http://localhost/ || exit 1

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]