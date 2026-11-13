# Contextual Reader - Crontab untuk Backup Harian
# Edit /etc/crontab atau jalankan: crontab -e

# Backup setiap jam 2 pagi
0 2 * * * /data/OpenBot/Shared/contextual-reader/infra/backup/scripts/backup.sh

# Optional: Backup tambahan setiap pagi jam 12 siang (backup mingguan)
0 12 * * 0 /data/OpenBot/Shared/contextual-reader/infra/backup/scripts/backup.sh weekly_backup

# Catatan: Pastikan rclone sudah dikonfigurasi
# rclone config
# remote: contextul-reader-backups