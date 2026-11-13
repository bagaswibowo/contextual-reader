# Cara Restore dari Backup

## 1. Test Restore (rekomendasi dulu)
```bash
cd /data/OpenBot/Shared/contextual-reader/infra
./backup/scripts/restore.sh
```

Output akan berisi:
- Lokasi test: `/tmp/contextual-reader-restore-test`
- Row count per tabel
- MD5 checksum database
- File count media

## 2. Restore ke Produksi (setelah test berhasil)

### Langkah manual:
```bash
cd /data/OpenBot/Shared/contextual-reader/infra

# Stop container
docker-compose down

# Hapus volume lama
rm -rf backend_data backend_media

# Restore dari test
cp -r /tmp/contextual-reader-restore-test/db_data/* backend_data/
cp -r /tmp/contextual-reader-restore-test/db_data/media/* backend_media/

# Start container
docker-compose up -d

# Verifikasi
docker-compose exec backend sqlite3 /app/db_data/db.sqlite3 "SELECT COUNT(*) FROM translations_wordtranslation;"
```

### Langkah otomatis (opsional):
```bash
cd /data/OpenBot/Shared/contextual-reader/infra
docker-compose down
rm -rf backend_data backend_media
docker-compose run --rm backend sh -c "cp /tmp/contextual-reader-restore-test/db_data/db.sqlite3 /app/db_data/db.sqlite3"
docker-compose run --rm backend sh -c "cp -r /tmp/contextual-reader-restore-test/db_data/media/* /app/media/"
docker-compose up -d
```

## 3. Restore dari Remote (jika tidak ada lokal)
```bash
cd /data/OpenBot/Shared/contextual-reader/infra
./backup/scripts/restore.sh
```

## 4. Verifikasi setelah restore
```bash
# Cek health endpoint
curl http://localhost:8088/api/core/health/

# Cek database
docker-compose exec backend sqlite3 /app/db_data/db.sqlite3 ".tables"
docker-compose exec backend sqlite3 /app/db_data/db.sqlite3 "SELECT COUNT(*) FROM translations_wordtranslation;"

# Cek media
docker-compose exec backend ls -lh /app/media/
```

## 5. Rolling back ke backup sebelumnya
Jika restore gagal:
```bash
# Cari daftar backup
rclone ls remote:contextual-reader-backups/daily/

# Download backup lain
cd /data/OpenBot/Shared/contextual-reader/infra/backup
rclone copy remote:contextual-reader-backups/daily/contextual-reader-20261110_120000.tar.gz db_media/

# Ekstrak
tar -xzf db_media/contextual-reader-20261110_120000.tar.gz -C /tmp/contextual-reader-restore-test

# Lanjutkan restore seperti di atas
```
