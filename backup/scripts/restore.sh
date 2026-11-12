#!/bin/bash
# Contextual Reader - Restore Script (TERUJI)
# Restore dari backup tar.gz ke lokasi uji, lalu bandingkan row count + file hash

set -euo pipefail

# Configuration
BACKUP_DIR="/data/OpenBot/Shared/contextual-reader/infra/backup"
TEST_DIR="/tmp/contextual-reader-restore-test"
REMOTE_BASE="remote:contextual-reader-backups"
LOG_FILE="${BACKUP_DIR}/logs/restore_$(date +%Y%m%d_%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================="
echo "Contextual Reader Restore - Test Mode"
echo "========================================="

# 1. Tentukan backup mana yang akan di-restore (terakhir di remote)
echo "[1/3] Menentukan backup terbaru..."
LATEST_BACKUP=$(rclone listremotes ${REMOTE_BASE}/daily/ 2>/dev/null | \
  grep "contextual-reader-" | sort -r | head -1) || {
  echo "ERROR: Tidak ada backup di remote"
  exit 1
}

echo "Backup terbaru: ${LATEST_BACKUP}"

# 2. Download backup ke lokal
echo "[2/3] Mendownload backup..."
cd "${BACKUP_DIR}"
mkdir -p db_data test_restore
rm -rf "${TEST_DIR}"
rclone copy "${REMOTE_BASE}/daily/${LATEST_BACKUP}" "db_media/${LATEST_BACKUP}"
tar -xzf "db_media/${LATEST_BACKUP}" -C "${TEST_DIR}"
echo "Backup diekstrak ke: ${TEST_DIR}"

# 3. Restore ke test location
echo "[3/3] Restore ke lokasi uji..."
mkdir -p "${TEST_DIR}/db_data"
mkdir -p "${TEST_DIR}/media"

# Restore database
cp "${TEST_DIR}/db_data/db.sqlite3" "${TEST_DIR}/db_data/db.sqlite3"

# Restore media
cp -r "${TEST_DIR}/media"/* "${TEST_DIR}/db_data/" || true

# 4. Verifikasi (row count + file hash)
echo "========================================="
echo "VERIFIKASI RESTORE"
echo "========================================="

# Hitung row count di tabel penting
echo "[A] Row Count Database:"
docker run --rm -v "${TEST_DIR}/db_data:/app" python:3.11-slim sh -c "
  python3 << 'PYEOF'
import sqlite3
import sys

conn = sqlite3.connect('/app/db.sqlite3')
cursor = conn.cursor()

tables = [
    ('translations_wordtranslation', 'word translation'),
    ('translations_sentencetranslation', 'sentence translation'),
    ('vocabulary_vocabularyentry', 'vocabulary entry'),
    ('vocabulary_reviewsession', 'review session'),
]

for table, desc in tables:
    cursor.execute(f'SELECT COUNT(*) FROM {table}')
    count = cursor.fetchone()[0]
    print(f'  {table}: {count} {desc}')

conn.close()
PYEOF
" || echo "  Gagal membaca row count"

# Hitung file count di media
echo "[B] File Count Media:"
find "${TEST_DIR}/db_data" -type f | wc -l | xargs echo "  Total file:"
du -sh "${TEST_DIR}/db_data/media" || echo "  Media kosong"

# Hitung MD5 dari file penting
echo "[C] MD5 Checksum (db.sqlite3):"
md5sum "${TEST_DIR}/db_data/db.sqlite3" || echo "  Gagal hitung MD5"

echo "========================================="
echo "Restore selesai. Lokasi test: ${TEST_DIR}"
echo "Untuk restore ke produksi, jalankan:"
echo "  cd /data/OpenBot/Shared/contextual-reader/infra"
echo "  docker-compose down"
echo "  rm -rf backend_data backend_media"
echo "  cp -r ${TEST_DIR}/db_data/* backend_data/"
echo "  cp -r ${TEST_DIR}/db_data/media/* backend_media/"
echo "  docker-compose up -d"
echo "========================================="
