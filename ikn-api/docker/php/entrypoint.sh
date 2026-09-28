#!/usr/bin/env sh
# Entrypoint ikn-api (LF!). Tunggu Postgres, siapkan storage, cache config/route di produksi,
# migrasi hanya bila RUN_MIGRATIONS=true, lalu jalankan perintah (php-fpm / queue:work / schedule:work).
set -eu

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_DATABASE="${DB_DATABASE:-ikn}"

echo "[entrypoint] waiting for postgres at ${DB_HOST}:${DB_PORT} ..."
i=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "[entrypoint] postgres not ready after 60s, giving up" >&2
    exit 1
  fi
  sleep 1
done

mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs \
         storage/app/public storage/app/private bootstrap/cache
[ -e public/storage ] || php artisan storage:link >/dev/null 2>&1 || true

if [ "${APP_ENV:-production}" = "production" ]; then
  php artisan config:cache
  php artisan route:cache
  php artisan view:cache
  php artisan event:cache
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] running migrations"
  php artisan migrate --force
fi

exec "$@"
