FROM php:8.3-cli

RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    sqlite3 \
    libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite pdo_mysql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY . .

RUN composer install --no-interaction --prefer-dist \
    && mkdir -p storage/framework/views storage/framework/cache storage/framework/sessions \
    && touch database/database.sqlite \
    && chmod 775 database/database.sqlite \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 8080
CMD php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
