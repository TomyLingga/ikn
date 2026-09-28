# syntax=docker/dockerfile:1.6
# ikn-api: Laravel 8.83.29 di PHP 8.1-fpm (KEPUTUSAN: bukan 8.2+). Satu image, tiga peran (app/queue/scheduler).
# Target: base (ekstensi), dev (composer + xdebug-less), prod (vendor --no-dev, non-root).

FROM php:8.1-fpm-bookworm AS base

ARG UID=1000
ARG GID=1000

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libpq-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libicu-dev \
        libonig-dev postgresql-client tzdata \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql mbstring bcmath intl gd zip exif pcntl opcache \
    && apt-get purge -y --auto-remove libpq-dev libzip-dev libpng-dev libjpeg62-turbo-dev libfreetype6-dev libicu-dev libonig-dev \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g "$GID" www && useradd -u "$UID" -g www -m -s /bin/bash www

COPY docker/php/www.conf /usr/local/etc/php-fpm.d/zz-www.conf
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/zz-opcache.ini
COPY docker/php/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/entrypoint

ENV TZ=Asia/Jakarta
WORKDIR /var/www/html

ENTRYPOINT ["entrypoint"]
CMD ["php-fpm"]

# ---------------------------------------------------------------- dev
FROM base AS dev
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
USER www

# ---------------------------------------------------------------- build vendor
FROM base AS vendor
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader
COPY . .
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative

# ---------------------------------------------------------------- prod
FROM base AS prod
COPY --from=vendor --chown=www:www /var/www/html /var/www/html
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www:www storage bootstrap/cache
USER www
