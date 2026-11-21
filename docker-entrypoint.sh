#!/bin/bash
set -e

echo "[Entrypoint] Contextual Reader All-in-One Bootstrapping..."

mkdir -p /app/db_data /app/db_data/cache /app/media /app/logs /app/staticfiles /var/log/nginx

# 1. Run migrations
echo "[Entrypoint] Running database migrations..."
python manage.py migrate --no-input || {
  echo "[Entrypoint] Migration failed"
  exit 1
}

# 2. Collect static files
if [ "$DEBUG" != "1" ]; then
  echo "[Entrypoint] Collecting static files..."
  python manage.py collectstatic --no-input --clear || true
fi

# 3. Start Gunicorn in background
echo "[Entrypoint] Starting Gunicorn on 127.0.0.1:8000..."
gunicorn reader.wsgi:application \
  --bind 127.0.0.1:8000 \
  --workers 3 \
  --timeout 120 \
  --access-logfile /app/logs/access.log \
  --error-logfile /app/logs/error.log \
  --log-level info &
GUNICORN_PID=$!

# 4. Wait for Gunicorn to become healthy
echo "[Entrypoint] Waiting for Gunicorn..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:8000/api/core/health/ >/dev/null 2>&1; then
    echo "[Entrypoint] Gunicorn is up and healthy."
    break
  fi
  sleep 1
done

# 5. Trap shutdown signals to terminate both processes gracefully
cleanup() {
  echo "[Entrypoint] Stopping services..."
  kill -TERM "$GUNICORN_PID" 2>/dev/null || true
  nginx -s quit 2>/dev/null || true
  wait "$GUNICORN_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# 6. Start Nginx in foreground
echo "[Entrypoint] Starting Nginx on port 80..."
nginx -g "daemon off;" &
NGINX_PID=$!

# Wait for any process to exit
wait -n "$GUNICORN_PID" "$NGINX_PID"
