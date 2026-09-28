#!/usr/bin/env bash
# Backup harian: pg_dump -Fc + tar storage/app, disalin ke object storage lewat rclone (ASUMSI A-20),
# retensi 7 harian + 4 mingguan. Cron host (WIB 02:00): 0 2 * * * /opt/ikn/backup.sh >> /var/log/ikn-backup.log 2>&1
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/ikn}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ikn}"
RCLONE_REMOTE="${RCLONE_REMOTE:-r2:ikn-backup}"   # remote rclone yang sudah dikonfigurasi (rclone config)
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.prod.yml"

STAMP="$(date +%Y%m%d-%H%M%S)"
DAY_OF_WEEK="$(date +%u)"   # 7 = Minggu → salinan mingguan
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

# shellcheck disable=SC1091
set -a; . "$DEPLOY_DIR/.env.docker"; set +a

echo "[$STAMP] dumping database $POSTGRES_DB"
$COMPOSE exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$BACKUP_DIR/daily/db-$STAMP.dump"

echo "[$STAMP] archiving storage/app"
$COMPOSE run --rm --no-deps -T --entrypoint sh app -c 'cd /var/www/html/storage && tar -czf - app' > "$BACKUP_DIR/daily/storage-$STAMP.tar.gz"

if [ "$DAY_OF_WEEK" = "7" ]; then
  cp "$BACKUP_DIR/daily/db-$STAMP.dump" "$BACKUP_DIR/weekly/"
  cp "$BACKUP_DIR/daily/storage-$STAMP.tar.gz" "$BACKUP_DIR/weekly/"
fi

# Retensi lokal
find "$BACKUP_DIR/daily" -type f -mtime +7 -delete
find "$BACKUP_DIR/weekly" -type f -mtime +28 -delete

# Salin ke luar server
if command -v rclone >/dev/null 2>&1; then
  rclone sync "$BACKUP_DIR" "$RCLONE_REMOTE" --transfers 2 --checkers 4
  echo "[$STAMP] synced to $RCLONE_REMOTE"
else
  echo "[$STAMP] WARNING: rclone not installed, backup only on local disk" >&2
fi

echo "[$STAMP] done: $(du -sh "$BACKUP_DIR" | cut -f1)"
