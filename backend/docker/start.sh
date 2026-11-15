#!/bin/sh
set -eu
php /var/www/html/docker/check-environment.php

# Only disposable runtime state lives here; persistent data belongs in PostgreSQL.
mkdir -p "$LARAVEL_STORAGE_PATH/framework/views" "$LARAVEL_STORAGE_PATH/framework/cache/data" \
    "$LARAVEL_STORAGE_PATH/framework/sessions" "$LARAVEL_STORAGE_PATH/logs" \
    /tmp/apache2
chown -R www-data:www-data "$LARAVEL_STORAGE_PATH" /tmp/apache2

# Explicit release/maintenance commands use the same environment and writable paths.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

PORT=${PORT:-8080}
case "$PORT" in
    ''|*[!0-9]*) echo 'PORT deve ser numérica.' >&2; exit 1 ;;
esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then
    echo 'PORT deve estar entre 1024 e 65535.' >&2
    exit 1
fi
# Apache config is generated on writable scratch space, never in the image filesystem.
cat > /tmp/apache2/ports.conf <<EOF_PORT
Listen 0.0.0.0:$PORT
EOF_PORT
exec apache2-foreground
