# Dockerfile untuk Frontend (Contextual Reader)
# Build context: ./frontend (lihat docker-compose.yml) — semua path relatif terhadap folder frontend/

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (package-lock.json wajib ikut context — jangan di-exclude)
# Jaringan server lambat/fluktuatif: npm ci pakai cache mount supaya unduhan yang
# sudah lengkap tidak diulang saat build retry.
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 15 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set fetch-timeout 300000 && \
    npm ci

# Build aplikasi
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:1.27-alpine

# Copy built files dari builder (vite outDir = dist/)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create logs directory
RUN mkdir -p /var/log/nginx

# Expose port
EXPOSE 80

# Healthcheck (runtime saja — jangan curl saat build, nginx belum jalan)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
