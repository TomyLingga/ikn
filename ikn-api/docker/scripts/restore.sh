#!/usr/bin/env bash
# Restore dari hasil backup.sh. Uji restore rutin ke DB sementara (ikn_restore_test) sebelum dipakai sungguhan.
#   restore.sh <db-dump.dump> [storage.tar.gz] [--target-db ikn_restore_test] [--apply]
# Tanpa --apply: hanya restore ke --target-db (default ikn_restore_test) dan membandingkan jumlah baris tabel utama.
# Dengan --apply: menghentikan app/queue/scheduler, restore ke DB produksi ($POSTGRES_DB) dan storage, lalu start kembali.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/ikn}"
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.prod.yml"
DUMP="${1:?usage: restore.sh <db-dump.dump> [storage.tar.gz] [--target-db NAME] [--apply]}"
shift
STORAGE=""
TARGET_DB="ikn_restore_test"
APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target-db) TARGET_DB="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    *) STORAGE="$1"; shift ;;
  esac
done

# shellcheck disable=SC1091
set -a; . "$DEPLOY_DIR/.env.docker"; set +a

if [ "$APPLY" = "1" ]; then
  TARGET_DB="$POSTGRES_DB"
  echo "Stopping application containers..."
  $COMPOSE stop app queue scheduler
fi

echo "Restoring $DUMP into database $TARGET_DB"
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";" >/dev/null || true
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$TARGET_DB\";"
$COMPOSE exec -T db pg_restore -U "$POSTGRES_USER" -d "$TARGET_DB" --no-owner --no-privileges < "$DUMP"

echo "Row counts in $TARGET_DB:"
$COMPOSE exec -T db psql -U "$POSTGRES_USER" -d "$TARGET_DB" -Atc \
  "SELECT 'users', count(*) FROM users UNION ALL SELECT 'orders', count(*) FROM orders UNION ALL SELECT 'products', count(*) FROM products UNION ALL SELECT 'media', count(*) FROM media;"

if [ -n "$STORAGE" ] && [ "$APPLY" = "1" ]; then
  echo "Restoring storage/app from $STORAGE"
  $COMPOSE run --rm --no-deps -T --entrypoint sh app -c 'cd /var/www/html/storage && rm -rf app && tar -xzf -' < "$STORAGE"
fi

if [ "$APPLY" = "1" ]; then
  $COMPOSE start app queue scheduler
  echo "Restore applied. Verify: curl -fsS https://$API_DOMAIN/up"
else
  echo "Dry-run restore finished in $TARGET_DB (not applied). Drop it with: docker compose exec db psql -U $POSTGRES_USER -d postgres -c 'DROP DATABASE \"$TARGET_DB\";'"
fi
