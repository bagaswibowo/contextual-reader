#!/bin/bash
# Contextual Reader - Daily Backup Script
# Backup database SQLite + media volume, kompresi, upload ke remote
# Retain: 7 harian, 4 mingguan

set -euo pipefail

# Configuration
BACKUP_DIR="/data/OpenBot/Shared/contextual-reader/infra/backup"
RETENTION_DAYS=7
RETENTION_WEEKS=4
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="contextual-reader-${BACKUP_DATE}.tar.gz"
REMOTE_BASE="remote:contextual-reader-backups"

# Paths
DB_SOURCE="/app/db_data/db.sqlite3"  # Di dalam container
MEDIA_SOURCE="/app/media"
LOCAL_DB_PATH="/tmp/contextual-reader-db.sqlite3"

# Logging
LOG_FILE="${BACKUP_DIR}/logs/backup_${BACKUP_DATE}.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================="
echo "Contextual Reader Backup - ${BACKUP_DATE}"
echo "========================================="

# 1. Backup Database SQLite (gunakan .backup untuk aman)
echo "[1/5] Membuat backup database SQLite..."
docker-compose exec -T backend sh -c "
  sqlite3 /app/db_data/db.sqlite3 '.backup /tmp/backup.sqlite3' &&
  cp /tmp/backup.sqlite3 /app/db_data/db.sqlite3.bak
" || {
  echo "ERROR: Gagal membuat backup database"
  exit 1
}

# Copy ke lokal untuk tar
echo "[2/5] Menyalin database ke lokal..."
docker cp contextual-reader-backend:${DB_SOURCE} "$LOCAL_DB_PATH" || {
  echo "ERROR: Gagal copy database dari container"
  exit 1
}

# 2. Backup Volume Media
echo "[3/5] Membuat arsip media..."
mkdir -p "${BACKUP_DIR}/media/${BACKUP_DATE}"
docker cp contextual-reader-backend:${MEDIA_SOURCE} "${BACKUP_DIR}/media/${BACKUP_DATE}/"

# 3. Kompresi
echo "[4/5] Membuat tar.gz..."
cd "${BACKUP_DIR}"
tar -czf "db_media/${BACKUP_FILE}" \
  -C db_data "${LOCAL_DB_PATH}" \
  -C media "${BACKUP_DATE}"

# Hapus file sementara
rm -f "${LOCAL_DB_PATH}"
rm -rf "${BACKUP_DIR}/media/${BACKUP_DATE}"

# 4. Upload ke Remote (rclone)
echo "[5/5] Mengupload ke remote..."
rclone copy "db_media/${BACKUP_FILE}" "${REMOTE_BASE}/daily/" || {
  echo "ERROR: Gagal upload ke remote"
  exit 1
}

# 5. Rotasi Backup
echo "Rotasi backup harian (retain ${RETENTION_DAYS} hari)..."
find "${BACKUP_DIR}/db_media" -name "contextual-reader-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo "Rotasi backup mingguan (retain ${RETENTION_WEEKS} minggu)..."
find "${BACKUP_DIR}/db_media" -name "contextual-reader-*.tar.gz" -type f -mtime +$((RETENTION_WEEKS * 7)) -delete

echo "========================================="
echo "Backup selesai: ${BACKUP_FILE}"
echo "========================================="
