#!/bin/bash
# Docker entrypoint untuk Contextual Reader Backend
# Menghandle startup dan setup awal

set -e

echo "[Entrypoint] Contextual Reader Backend Bootstrapping..."

# 1. Setup directories
echo "[Entrypoint] Setup directories..."
mkdir -p /app/db_data /app/media /app/logs /app/staticfiles

# 2. Run migrations (jika DB kosong)
echo "[Entrypoint] Check migration status..."
python manage.py migrate --no-input || {
  echo "[Entrypoint] Migration gagal, cek logs di atas"
  exit 1
}

# 3. Collect static files jika DEBUG=False
if [ "$DEBUG" != "1" ]; then
  echo "[Entrypoint] Collecting static files..."
  python manage.py collectstatic --no-input --clear || {
    echo "[Entrypoint] collectstatic gagal"
    exit 1
  }
fi

# 4. Start Gunicorn
echo "[Entrypoint] Starting Gunicorn..."
exec gunicorn reader.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120 \
  --access-logfile /app/logs/access.log \
  --error-logfile /app/logs/error.log \
  --log-level info